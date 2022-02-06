import { Sequelize, Model, DataTypes, Op } from "sequelize";
import { countRowOfCode, getNbContributors } from "../helpers/helper";
import { Categorization, CategorizationEnum } from "./categorize";
import { db } from "./database";

interface RepositoryAttributes {
    //common
    id: number;
    owner: string;
    name: string;
    language: string;
    //stats
    forks: number;
    stars: number;
    rowsOfCode: number;
    contributors: number;
    createdAt: Date;
    updatedAt: Date;

}

export class Project extends Model<RepositoryAttributes> {
    declare id: number;
    declare owner: string;
    declare name: string;
    declare language: string;
    declare forks: number;
    declare stars: number;
    declare rowsOfCode: number;
    declare contributors: number;
    declare createdAt: Date;
    declare updatedAt: Date;
}

Project.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
    },
    owner: DataTypes.STRING,
    name: DataTypes.STRING,
    language: DataTypes.STRING,
    forks: DataTypes.INTEGER,
    stars: DataTypes.INTEGER,
    rowsOfCode: DataTypes.BIGINT,
    contributors: DataTypes.INTEGER,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
}, { sequelize: db, modelName: 'project' });

export async function saveProject(repo: any): Promise<Project> {
   return Project.create({
    id: repo.id,
    owner: repo.owner.login,
    name: repo.name,
    language: repo.language,
    forks: repo.forks_count,
    stars: repo.stargazers_count,
    rowsOfCode: await countRowOfCode(repo.name, repo.id),
    contributors: await getNbContributors(repo),
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
   });
}

export async function getAllProject(ignores: CategorizationEnum[] = []): Promise<Project[]> {
    const categorization = await Categorization.findAll({
        where: {
            category: {
                [Op.in]: ignores,
            },
        },
    });
    return Project.findAll({
        where: {
            id: {
                [Op.notIn]: categorization.map((c) => c.id),
            },
        },
    });
}

export async function getProjectsByCategorie(filtre: CategorizationEnum): Promise<Project[]> {
    const categorization = await Categorization.findAll({
        where: {
            category: {
                [Op.eq]: filtre,
            },
        },
    });
    return Project.findAll({
        where: {
            id: {
                [Op.in]: categorization.map((c) => c.id),
            },
        },
    });
}