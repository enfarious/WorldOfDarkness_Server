import passport from 'passport';
import { Strategy as OpenIDConnectStrategy, Profile } from 'passport-openidconnect';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { Express, Request, Response, NextFunction } from 'express';
import { prisma } from '@/database/DatabaseService';
import { logger } from '@/utils/logger';

const PgSession = connectPg(session);

interface UserClaims {
  sub: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
}

declare global {
  namespace Express {
    interface User {
      claims: UserClaims;
      accountId: string;
    }
  }
}

async function upsertAccount(claims: UserClaims) {
  const existingAccount = await prisma.account.findUnique({
    where: { replitId: claims.sub },
  });

  if (existingAccount) {
    return prisma.account.update({
      where: { id: existingAccount.id },
      data: {
        email: claims.email ?? existingAccount.email,
        firstName: claims.first_name ?? existingAccount.firstName,
        lastName: claims.last_name ?? existingAccount.lastName,
        profileImageUrl: claims.profile_image_url ?? existingAccount.profileImageUrl,
        lastLoginAt: new Date(),
      },
    });
  }

  const baseUsername = claims.email?.split('@')[0] ?? `user_${claims.sub.slice(0, 8)}`;
  const uniqueUsername = await generateUniqueUsername(baseUsername);

  return prisma.account.create({
    data: {
      replitId: claims.sub,
      email: claims.email ?? null,
      username: uniqueUsername,
      firstName: claims.first_name ?? null,
      lastName: claims.last_name ?? null,
      profileImageUrl: claims.profile_image_url ?? null,
      lastLoginAt: new Date(),
    },
  });
}

async function generateUniqueUsername(baseUsername: string): Promise<string> {
  let username = baseUsername;
  let counter = 1;
  
  while (await prisma.account.findUnique({ where: { username } })) {
    username = `${baseUsername}${counter}`;
    counter++;
  }
  
  return username;
}

export async function setupAuth(app: Express): Promise<void> {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  const sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'sessions',
    createTableIfMissing: true,
  });

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax',
    },
  };

  app.set('trust proxy', 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  const replit_deployment_url = process.env.REPLIT_DEPLOYMENT_URL;
  const replit_dev_domain = process.env.REPLIT_DEV_DOMAIN;
  const callbackUrl = replit_deployment_url
    ? `https://${replit_deployment_url}/api/auth/callback`
    : `https://${replit_dev_domain}/api/auth/callback`;

  passport.use(
    new OpenIDConnectStrategy(
      {
        issuer: 'https://replit.com/',
        authorizationURL: 'https://replit.com/auth/authorize',
        tokenURL: 'https://replit.com/auth/token',
        userInfoURL: 'https://replit.com/auth/userinfo',
        clientID: process.env.REPLIT_CLIENT_ID || 'replit',
        clientSecret: process.env.REPLIT_CLIENT_SECRET || '',
        callbackURL: callbackUrl,
        scope: ['openid', 'profile', 'email'],
      },
      async (
        _issuer: string,
        profile: Profile,
        done: (err: Error | null, user?: Express.User) => void
      ) => {
        try {
          const claims: UserClaims = {
            sub: profile.id,
            email: profile.emails?.[0]?.value,
            first_name: profile.name?.givenName,
            last_name: profile.name?.familyName,
            profile_image_url: profile.photos?.[0]?.value,
          };

          const account = await upsertAccount(claims);
          
          done(null, { claims, accountId: account.id });
        } catch (error) {
          logger.error({ error }, 'Error in OpenID Connect strategy');
          done(error as Error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: Express.User, done) => {
    done(null, user);
  });

  logger.info('Replit Auth configured successfully');
}

export function registerAuthRoutes(app: Express): void {
  app.get('/api/login', passport.authenticate('openidconnect'));

  app.get(
    '/api/auth/callback',
    passport.authenticate('openidconnect', {
      failureRedirect: '/',
      successRedirect: '/',
    })
  );

  app.get('/api/logout', (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        logger.error({ error: err }, 'Error during logout');
      }
      res.redirect('/');
    });
  });

  app.get('/api/auth/user', (req: Request, res: Response) => {
    if (req.isAuthenticated() && req.user) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: 'Not authenticated' });
    }
  });
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized' });
}
