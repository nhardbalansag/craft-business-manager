import type { Material } from '../../domain/materials';

/**
 * Persistence boundary used by material application services.
 *
 * Implementations may be in-memory, Excel-backed, SQLite-backed, or another
 * storage technology. Application services must not know spreadsheet cells or
 * filesystem details.
 */
export interface MaterialRepository {
  list(): Promise<Material[]>;
  findById(id: string): Promise<Material | null>;
  insert(material: Material): Promise<void>;
  replace(material: Material): Promise<void>;
}
