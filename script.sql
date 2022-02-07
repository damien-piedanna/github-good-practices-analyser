-- Count project number > 2000 lignes de codes
select count(*)
from projects
where rowsOfCode > 2000;


-- Repartisions of stars by project categories
select category, count(p.stars) as total
from categorizations c left join projects p on c.id = p.id
where rowsOfCode > 2000
group by category;

-- Somme des dependencies et moyenne des mauvaises dependencies
select sum(dda.quantityOfDependencies + dda.quantityOfDevDependencies), AVG(dda.quantityOfWrongDevDependencies/dda.quantityOfTargetDependencies) as AVGOfWrongPlaceForDependancies
from projects p
    left join categorizations c on p.id = c.id
    left join DevDependenciesAnalyzes dda on dda.id = c.id
where
    c.category != 'other';

-- Query on % WrongDevDependenciesEvolutionByCategory
select count(*)as total, c.category, AVG(dda.quantityOfWrongDevDependencies*100/dda.quantityOfTargetDependencies) as AVGOfWrongPlaceForDependancies
from projects p
    left join categorizations c on p.id = c.id
    left join DevDependenciesAnalyzes dda on dda.id = c.id
where
    c.category != 'other'
and dda.quantityOfTargetDependencies >= 1
and p.rowsOfCode > 4000
group by c.category;


-- Query on the biggest project (contributor or rowof code) % WrongDevDependenciesEvolutionByCategory
select p.name, p.contributors, p.rowsOfCode, c.category, dda.quantityOfWrongDevDependencies, dda.quantityOfTargetDependencies, (dda.quantityOfWrongDevDependencies*100/dda.quantityOfTargetDependencies)  as PourcentageOfWrongPlaceForDependancies
from projects p
    left join categorizations c on p.id = c.id
    left join DevDependenciesAnalyzes dda on dda.id = c.id
where
    c.category != 'other'
-- order by p.contributors DESC;
order by p.rowsOfCode DESC;

-- Export for Excel wrongUseOfDependancies
select p.name, p.contributors, p.rowsOfCode, p.stars, c.category, (dda.quantityOfDependencies+dda.quantityOfDevDependencies) as depdenciesTotal, dda.quantityOfWrongDevDependencies, dda.quantityOfTargetDependencies , (dda.quantityOfWrongDevDependencies*100/dda.quantityOfTargetDependencies)  as PourcentageOfWrongPlaceForDependancies
from projects p
    left join categorizations c on p.id = c.id
    left join DevDependenciesAnalyzes dda on dda.id = c.id
where
    c.category != 'other'
and rowsOfCode > 2000
order by p.contributors DESC;


-- Repartition des projets en fonction du nombre de contributeur
select t.range as [Nb Contributeur], count(*) as [Nombre de projet]
from (
  select case
    when projects.contributors between 0 and 9 then ' 0-9'
    when projects.contributors between 10 and 19 then '10-19'
    when projects.contributors between 20 and 29 then '20-29'
    when projects.contributors between 30 and 39 then '30-39'
    when projects.contributors between 40 and 49 then '40-49'
    when projects.contributors between 50 and 59 then '50-59'
    when projects.contributors between 60 and 69 then '60-69'
    when projects.contributors between 70 and 79 then '70-79'
    when projects.contributors between 80 and 89 then '80-89'
    when projects.contributors between 90 and 99 then '90-99'
    else '99+' end as range
  from projects left join categorizations c on c.id = projects.id
    where projects.rowsOfCode > 2000
    and c.category != 'other' ) t
group by t.range

