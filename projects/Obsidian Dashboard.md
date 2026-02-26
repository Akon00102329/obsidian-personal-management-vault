---
deadline: 2026-03-21
---
# Goals
Obtener un panel de visualización del estado de mi vida, mis finanzas y mi desarrollo personal. Poder manejar mejor mi tiempo para disfrutar de los míos y desarrollar proyectos con eficacia
# Next Actions
> [!note] Proyectos
> - [ ] Proyectos **feat** filtrar proyectos en marcha (que no estén empty o finished)
> - [ ] Proyectos **feat** opción de que en el card pueda añadirse cuántos días hasta la deadline
 
> [!note] Calendario
>- [ ] Calendario **feat** mostrar el streak de hábitos al lado del nombre

> [!note] FInanzas
> - [ ] Finanzas **mejora ui** asociar un color a un gasto
> - [ ] finanzas **feat** asignar un ícono al tipo y tener un tipo default, poner un tooltip para conocer más del tipo

> [!note] General
> - [ ] General **hotfix** Hacer el vault responsive a teléfono
> - [ ] Hooks: **feature** crear un hook con templater para que se ejecute el guardado de los monthly snapshots 
> - [ ] Hook **feature** rollout pero únicamente de la sección tareas del día anterior mediante un hook de `templater`
# Refactor
- [ ] mejorar la estructura de finance scope
- [ ] comprobar si se puede crear una tasklist con un array
- [ ] unificar parsings en un módulo coherente
# Backlog

- [ ] sección de limpieza basado en el libro de sidetracked home executives
- [ ] Proyectos **feat** función `archived done` para proyectos con mucas tareas, luego tendría que sumarse las tareas done con las tareas de next action. también podrían eliminarse o enviarlas al final del archivo si es un proyecto por fases y por ejemplo, se ha terminado dicha fase
- [ ] Proyectos: **feat** agregar puntuación a las tasks, ya que no todas tienen igual impacto
- [ ] Proyectos **feat** propiedad de revisión (cada n días) para poder decir cómo evoluciona el proyecto, en caso de que un proyecto no tenga fin
- [ ] Proyectos **feat** gráfico burndown
- [ ] Calendario **feat** tener íconos de planes personalizados según si pertenece a algún proyecto, se hará mediante el enlace a una página de proyectos desde la parte de planes p.e. `- [ ] Hackathon dia 1 [[proyectoX]]`
- [ ] Proyectos **mejora-ui** cambiar el color de los proyectos según el estado (waiting, active, empty)
- [ ] Finanzas **feat** asignar un color en la celda de tipo según la tabla (o mejor aún, que sea en el formato etiqueta)
- [ ] Personas **feat** Calcular el last-time-seen según la mención en la sección "planes"
- [ ] Calendario **feat** añadir un botón que lance un hook de `templater` para poder asingar a planes no concretados una fecha
- [ ] Calendario: **feat** separar el track de gym para que enlace a la página hecha ese día
- [ ] Calendario: Añadir eventos que duren días, tipo, plazos para hacer x o y entrega, para poder visualizarlo en el calendario
- [ ] Finanzas **hotfix** diferenciar entre pago de deudas en efectivo y a la cuenta corriente, añadirle `#bizum` como etiqueta por defecto, y quitarla manualmente en caso de que el pago no se haga via bizum
- [ ] General **feat** pegar el apartado proyección semanal dentro del dashboard para que cada semana puedas tener tus metas claras
- [ ] Agregar un apartado de imágenes para poder ver las fotos de hace un año??
- [ ] General **feat** definir una configuración idioma (en, es)
- [ ] General **feature** tener un pequeño apartado de bot de selenium (tiempo, filmoteca)
# Brainstorming
- Pensar sobre la parte del gym: guardar los datos, cómo generar las plantilas
- Definir una función que alterne entre colores legibles entre sí, si existe en el mismo gráfico dos colores iguales, o que son muy parecidos, o que combinan mal en legibilidad, alternar en otros
# Resources
- otro proyecto con dvjs https://github.com/702573N/Obsidian-Tasks-Calendar

