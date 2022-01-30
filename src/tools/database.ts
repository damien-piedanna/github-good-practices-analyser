import { Sequelize, Model, DataTypes } from "sequelize";
import path from "path";

export const db = new Sequelize({
    dialect: 'sqlite',
    storage: path.resolve(path.resolve(__dirname,'../..'), 'database.sqlite'),
    logging: false,
});

interface RepositoryAttributes {
    //common
    id: number;
    name: string;
    language: string;
    //state
    status?: string;
    category?: string;
    //stats
    forks: number;
    stars: number;
    createdAt: Date;
    updatedAt: Date;
    //rules
    ruleLinter?: boolean;
    ruleDevDependencies?: number;
}
export class Repository extends Model<RepositoryAttributes> {
    declare id: number;
    declare name: string;
    declare language: string;
    declare status: string;
    declare category: string;
    declare forks: number;
    declare stars: number;
    declare createdAt: Date;
    declare updatedAt: Date;
    declare ruleLinter: boolean;
    declare ruleDevDependencies: number;
}
Repository.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
    },
    name: DataTypes.STRING,
    language: DataTypes.STRING,
    status: {
        type: DataTypes.STRING,
        defaultValue: 'uncategorized',
    },
    category: {
        type: DataTypes.STRING,
        defaultValue: '',
    },
    forks: DataTypes.INTEGER,
    stars: DataTypes.INTEGER,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    ruleLinter: DataTypes.BOOLEAN,
    ruleDevDependencies: DataTypes.INTEGER,
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
            status: status,
        },
    });
}

export function getAllRepository(): Promise<Repository[]> {
    return Repository.findAll({});
}

/**
 * Get categorized repositories by category
 */
export function getRepositoriesByStatusAndCategory(status: string, category: string): Promise<Repository[]> {
    return Repository.findAll({
        where: {
            status: status,
            category: category,
        },
    });
}