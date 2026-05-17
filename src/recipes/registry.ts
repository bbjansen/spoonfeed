import type { RecipeDefinition, RecipeId, ProjectType } from '../types.js';

export class RecipeRegistry {
  private recipes = new Map<RecipeId, RecipeDefinition>();

  register(recipe: RecipeDefinition): void {
    this.recipes.set(recipe.id, recipe);
  }

  get(id: RecipeId): RecipeDefinition | undefined {
    return this.recipes.get(id);
  }

  getAll(): RecipeDefinition[] {
    return [...this.recipes.values()];
  }

  getCompatibleWith(projectType: ProjectType): RecipeDefinition[] {
    return this.getAll().filter((r) => {
      if (r.compatibleWith === 'all') return true;
      return r.compatibleWith.includes(projectType);
    });
  }

  getByCategory(category: string): RecipeDefinition[] {
    return this.getAll().filter((r) => r.category === category);
  }
}
