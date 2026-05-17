import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility, InferSubjects } from '@casl/ability';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

export enum Role {
  User = 'user',
  Admin = 'admin',
  SuperAdmin = 'super-admin',
}

export type AppAbility = MongoAbility;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: { id: string; role: Role }): AppAbility {
    const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

    switch (user.role) {
      case Role.SuperAdmin:
        can(Action.Manage, 'all');
        break;
      case Role.Admin:
        can(Action.Read, 'all');
        can(Action.Create, 'all');
        can(Action.Update, 'all');
        cannot(Action.Delete, 'User');
        break;
      case Role.User:
        can(Action.Read, 'all');
        can(Action.Update, 'User', { id: user.id });
        break;
    }

    return build();
  }
}
