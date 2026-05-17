import { Module } from '@nestjs/common';
import { AdminModule as AdminJSModule } from '@adminjs/nestjs';
import AdminJS from 'adminjs';

@Module({
  imports: [
    AdminJSModule.createAdminAsync({
      useFactory: () => ({
        adminJsOptions: {
          rootPath: '/admin',
          branding: {
            companyName: 'Admin Panel',
            softwareBrothers: false,
          },
          resources: [
            // Register your entities here:
            // {
            //   resource: UserEntity,
            //   options: {
            //     properties: {
            //       password: { isVisible: false },
            //     },
            //   },
            // },
          ],
        },
        auth: {
          authenticate: async (email: string, password: string) => {
            const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
            const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme';

            if (email === adminEmail && password === adminPassword) {
              return { email: adminEmail };
            }
            return null;
          },
          cookieName: 'adminjs',
          cookiePassword: process.env.ADMIN_SESSION_SECRET ?? 'change-me-in-production',
        },
        sessionOptions: {
          resave: false,
          saveUninitialized: false,
          secret: process.env.ADMIN_SESSION_SECRET ?? 'change-me-in-production',
        },
      }),
    }),
  ],
})
export class AdminModule {}
