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
    owner: string;
    name: string;
    language: string;
    //state
    category?: string;
    //stats
    forks: number;
    stars: number;
    contributors: number;
    createdAt: Date;
    updatedAt: Date;
    //rules
    ruleLinter?: boolean;
    ruleDevDependencies?: number;
}
export class Repository extends Model<RepositoryAttributes> {
    declare id: number;
    declare owner: string;
    declare name: string;
    declare language: string;
    declare category: string;
    declare forks: number;
    declare stars: number;
    declare contributors: number;
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
    owner: DataTypes.STRING,
    name: DataTypes.STRING,
    language: DataTypes.STRING,
    category: {
        type: DataTypes.STRING,
        defaultValue: '',
    },
    forks: DataTypes.INTEGER,
    stars: DataTypes.INTEGER,
    contributors: DataTypes.INTEGER,
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
 * Get all repository from database
 */
export function getAllRepository(): Promise<Repository[]> {
    return Repository.findAll({});
}