import { Module } from '@nestjs/common';
import { I18nModule, AcceptLanguageResolver, QueryResolver } from 'nestjs-i18n';
import path from 'node:path';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '../../i18n/'),
        watch: true,
      },
      resolvers: [{ use: QueryResolver, options: ['lang'] }, AcceptLanguageResolver],
    }),
  ],
})
export class InternationalizationModule {}
