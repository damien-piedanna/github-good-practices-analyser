import { Sequelize, Model, DataTypes } from "sequelize";
import { getNbContributors } from "../main";
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
    contributors: await getNbContributors(repo),
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
   });
}

export function getAllProject(): Promise<Project[]> {
    return Project.findAll({});
}