import { CategorizationEnum, categorizeProject, clearAllCategorization } from '../database/categorize';
import { db } from '../database/database';
import { getAllProject, Project } from '../database/project.db';
import { getDependencies, hasDependency } from '../helpers/helper';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    await db.sync();
    console.log('🚀 Start categorization \n');

    await clearAllCategorization();

    const projects = await getAllProject();
    let ended = 0;
    const tasks = projects.map(async (project: Project) => {
        const dependencies = await getDependencies(project).catch(() => { return {} });
        const category = foundCategory(dependencies);
        await categorizeProject(project, category);
        ended++;
        process.stdout.write(`\r⌛ Categorization... ${ended}/${projects.length}`);
    });
    await Promise.all(tasks);
    console.log('\n🏁 End of categorization');
    process.exit(0);
})();


/**
 * Found repository category
 * @param dependencies
 */
 function foundCategory(dependencies: Record<string, string>): CategorizationEnum {
    switch (true) {
        case hasDependency(dependencies, '@angular/core'): {
            return "angular";
        }
        case hasDependency(dependencies, 'vue'): {
            return "vue";
        }
        case hasDependency(dependencies, '@nestjs/core'): {
            return "nestjs";
        }
        case hasDependency(dependencies, 'next'): {
            return "next";
        }
        case hasDependency(dependencies, 'react'): {
            return "react";
        }
        case hasDependency(dependencies, 'express'): {
            return "express";
        }
        case hasDependency(dependencies, 'webpack'): {
            return "native";
        }
    }
    return "other";
}



/**
 * Return if a repository use webpack
 * @param dependencies
 * @param category
 */
function isWebpackRepository(dependencies: Record<string, string> | {}, category: string): boolean {
    if (['angular', 'next', 'vue'].includes(category)) {
        return true;
    }
    return hasDependency(dependencies, 'webpack');
}