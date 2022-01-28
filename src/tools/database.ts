import { Sequelize, Model, DataTypes } from "sequelize";
import path from "path";

export const db = new Sequelize({
    dialect: 'sqlite',
    storage: path.resolve(path.resolve(__dirname,'../..'), 'database.sqlite'),
    logging: false,
});

interface RepositoryAttributes {
    id: number;
    name: string;
    category: string;
}
class Repository extends Model<RepositoryAttributes> {
    declare id: number;
    declare name: string;
    declare category: string;
}
Repository.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
    },
    name: DataTypes.STRING,
    category: {
        type: DataTypes.STRING,
        defaultValue: 'undefined',
    },
}, { sequelize: db, modelName: 'repository' });

/**
 * Save a repository in the database
 * @param repository
 */
export function saveRepository(repository: RepositoryAttributes): Promise<[Repository, (boolean | null)]> {
    return Repository.upsert(repository);
}

/**
 * Get uncategorized repositories
 */
export function getUncategorizedRepositories(): Promise<Repository[]> {
    return getRepositoryByCategory('unknown');
}

export function getAllRepository(): Promise<Repository[]> {
    return Repository.findAll({});
}

/**
 * Get repositories by category
 * @param category
 */
export function getRepositoryByCategory(category: string): Promise<Repository[]> {
    return Repository.findAll({
        where: {
            category: category,
        },
    });
}