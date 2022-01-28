import { Sequelize, Model, DataTypes, Op } from "sequelize";
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
    status: string;
}
export class Repository extends Model<RepositoryAttributes> {
    declare id: number;
    declare name: string;
    declare category: string;
    declare status: string;
}
Repository.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
    },
    name: DataTypes.STRING,
    category: DataTypes.STRING,
    status: DataTypes.STRING,
}, { sequelize: db, modelName: 'repository' });

/**
 * Insert a repository in the database
 * @param repository
 */
export function insertRepository(repository: RepositoryAttributes): Promise<Repository> {
    return Repository.create(repository);
}

/**
 * Get categorized repositories
 */
export function getRepositoriesByStatus(status: string): Promise<Repository[]> {
    return Repository.findAll({
        where: {
            status: status
        }
    });
}

/**
 * Get categorized repositories by category
 */
export function getRepositoriesByStatusAndCategory(status: string, category: string): Promise<Repository[]> {
    return Repository.findAll({
        where: {
            status: status,
            category: category,
        }
    });
}