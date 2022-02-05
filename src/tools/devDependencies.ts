import { PathLike } from 'fs';
import { CategorizationEnum, categorizeProject, clearAllCategorization } from '../database/categorize';
import { db } from '../database/database';
import { getAllProject, Project } from '../database/project.db';
import { getStructuredDependencies, hasDependency, resolveLocalPath } from '../helpers/helper';
import * as fs from 'fs/promises';
import path from 'path';
import { clearAllDevDependenciesAnalyze, DevDependenciesAnalyzeAttributes, saveDevDependenciesAnalyze } from '../database/devDependenciesAnalyze';
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    await db.sync();
    console.log('🚀 Start of DevDependencies categorization \n');

    await clearAllDevDependenciesAnalyze();

    const projects = await getAllProject(['other']);
    let ended = 0;
    const tasks = projects.map(async (project: Project) => {
        await checkWrongPlaceForDependencies(project);
        ended++;
        process.stdout.write(`\r⌛ Pending DevDependencies anaylze... ${ended}/${projects.length}`);
    });
    await Promise.all(tasks);
    console.log('\n🏁 End of DevDependencies categorization');
    process.exit(0);
})();


/**
 * Checks the number of misplaced dev dependencies
 * @param project
 */
 async function checkWrongPlaceForDependencies(project: Project): Promise<void> {
    
    const devDependenciesFile = JSON.parse((await fs.readFile(path.resolve(__dirname, '../../src/info/devDependencies.info.json'))).toString());
    const mostCommonDevDependencies: string[] = devDependenciesFile.mostCommon;
    
    const dependencies = await getStructuredDependencies(project);
    
    const quantityOfDependencies = Object.keys(dependencies.dependencies ?? {}).length;
    const quantityOfDevDependencies = Object.keys(dependencies.devDependencies ?? {}).length;

    const quantityOfTargetDependencies = Object.keys({...dependencies.dependencies, ...dependencies.devDependencies}).filter(dependency => mostCommonDevDependencies.includes(dependency)).length;
    const quantityOfWrongDevDependencies = Object.keys(dependencies.dependencies ?? {}).filter(dependency => mostCommonDevDependencies.includes(dependency)).length;
    
    const devDependenciesAnalyze: DevDependenciesAnalyzeAttributes = {
        id: project.id,
        quantityOfDependencies: quantityOfDependencies,
        quantityOfDevDependencies: quantityOfDevDependencies,
        quantityOfTargetDependencies: quantityOfTargetDependencies,
        quantityOfWrongDevDependencies: quantityOfWrongDevDependencies,
    };
    await saveDevDependenciesAnalyze(devDependenciesAnalyze);


}