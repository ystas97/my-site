/** Резервные данные, если Supabase недоступен (сайт читает через load-projects.js) */
window.PROJECTS_LOCAL = [
  {
    title: "детская художественная школа",
    city: "альметьевск",
    year: "2022",
    image: "project-01.jpg",
    gallery: ["project-01.jpg", "project-02.jpg", "project-03.jpg"],
  },
  {
    title: "детская художественная школа",
    city: "альметьевск",
    year: "2022",
    image: "project-02.jpg",
    gallery: ["project-02.jpg", "project-03.jpg", "project-04.jpg"],
  },
  {
    title: "детская художественная школа",
    city: "альметьевск",
    year: "2022",
    image: "project-03.jpg",
    gallery: ["project-03.jpg", "project-04.jpg", "project-01.jpg"],
  },
  {
    title: "детская художественная школа",
    city: "альметьевск",
    year: "2022",
    image: "project-04.jpg",
    gallery: ["project-04.jpg", "project-01.jpg", "project-02.jpg"],
  },
  {
    title: "детская художественная школа",
    city: "альметьевск",
    year: "2022",
    image: "project-02.jpg",
    gallery: ["project-02.jpg", "project-04.jpg"],
  },
  {
    title: "детская художественная школа",
    city: "альметьевск",
    year: "2022",
    image: "project-03.jpg",
    gallery: ["project-03.jpg", "project-05.jpg"],
  },
  {
    title: "детская художественная школа",
    city: "альметьевск",
    year: "2022",
    image: "project-04.jpg",
    gallery: ["project-04.jpg", "project-06.jpg"],
  },
  {
    title: "детская художественная школа",
    city: "альметьевск",
    year: "2022",
    image: "project-01.jpg",
    gallery: ["project-01.jpg", "project-07.jpg"],
  },
  {
    title: "Реновация физико-математического лицея",
    city: "альметьевск",
    year: "2016",
    image: "project-05.jpg",
    gallery: ["project-05.jpg", "project-06.jpg", "project-07.jpg"],
  },
  {
    title: "Реновация физико-математического лицея",
    city: "альметьевск",
    year: "2016",
    image: "project-06.jpg",
    gallery: ["project-06.jpg", "project-07.jpg"],
  },
  {
    title: "Реновация физико-математического лицея",
    city: "альметьевск",
    year: "2016",
    image: "project-07.jpg",
    gallery: ["project-07.jpg", "project-08.jpg"],
  },
  {
    title: "Реновация физико-математического лицея",
    city: "альметьевск",
    year: "2016",
    image: "project-08.jpg",
    gallery: ["project-08.jpg", "project-05.jpg"],
  },
  {
    title: "Реновация культурного центра Космос в Лениногорске",
    city: "лениногорск",
    year: "2016",
    image: "project-04.jpg",
    gallery: ["project-04.jpg", "project-02.jpg", "project-08.jpg"],
  },
  {
    title: "Клубный жилой дом",
    city: "альметьевск",
    year: "2016",
    image: "project-02.jpg",
    gallery: ["project-02.jpg", "project-06.jpg"],
  },
  {
    title: "Концепция офисно-производственного кластера",
    city: "альметьевск",
    year: "2016",
    image: "project-03.jpg",
    gallery: ["project-03.jpg", "project-07.jpg"],
  },
  {
    title: "ПЕРЕЦ",
    city: "альметьевск",
    year: "2016",
    image: "project-08.jpg",
    gallery: ["project-08.jpg", "project-09.png", "project-10.png"],
  },
];

window.PROJECTS_LOCAL.forEach((project) => {
  if (!project.status) project.status = "Концепция";
  if (!project.typology) project.typology = "Общественное здание";
  if (project.description) return;
  project.description =
    `Проект «${project.title}» — ${project.city}, ${project.year}. ` +
    "Архитектурная концепция, разработка проектной и рабочей документации. " +
    "В основе решения — функциональная планировка, связь с городской средой и выразительность фасадов.";
});
