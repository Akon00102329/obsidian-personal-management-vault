---
deadline: 2026-03-01
---
# Goals
Obtener un panel de visualización del estado de mi vida, mis finanzas y mi desarrollo personal. Poder manejar mejor mi tiempo para disfrutar de los míos y desarrollar proyectos con eficacia
# Next Actions

> [!note]+ Proyectos
> - [x] Proyectos: poder navegar al proyecto desde el título del proyecto
> - [x] Proyectos: **feat** agregar un paginador en los proyectos para visualizarlo de 3 en 3
> - [x] Proyectos: **mejora-ui** mover la ubicación para que quede fuera del scope semanal para que quede más claro la asociación (por cercanía)

> [!NOTE]+ Calendario
> - [x] Calendario: **bugfix** quitar el check uncheck si la fecha todavía no ha pasado
> - [x] Calendario: **bugfix** arreglar el tema de los hábitos cuando se introducen y cuando terminan
> - [x] Calendario: **feat** Añadir una funcionalidad de cumpleaños, según una lista de personas, añadir en eventos los cumpleaños de ciertas personas, e incluso cambiar de color o ícono para señalarlo
> - [x] Calendario: **bugfix** los hábitos en vista mensual deben seguir completándose semana por semana, no por el scope mensual, parece que los ítems desaparecen cuando la vista es hacia atrás en la vista mensual
> - [x] Calendario: **mejora-ui** aumentar la legiblidad del texto de `other-month` en el calendario

> [!NOTE]+ Finanzas
> - [x] Finanzas **bug** al cambiar de vista se regenera mal los panes de financecharts
> - [x] Finanzas: **feat** añadir espacio de efectivo, para controlar más los gastos en efectivo, ya que se ofusca la trazabilidad de la cuenta
> - [x] Finanzas: **feat** conseguir enlazar las páginas al día
> - [x] Finanzas: **bugfix** no se puede poner más de una etiqueta por defecto
> - [x] Finanzas: **mejora-ui** quitar deudas del recuadro, pero añadir un apartado cuentas que tenga ahorro, corriente y efectivo stacked

> [!NOTE]+ Salud
> - [x] Health: **bugfix** añadir la segunda marca para el ranking de calidad
> - [x] Health: **feat** añadir el dataset de waterintake
> - [x] Health: **mejora-ui**: aumentar legibilidad del cuadro de salud

> [!INFO]+ Otros-general
> - [x] Mejora UI: Esconder títulos de elementos si no existe la información precisa (sobre todo en el apartado finanzas)
> - [x] Mejora UI: seguir el tema del usuario
> - [x] **config** separar la configuración
> - [x] **config** crear repositorio con datos de prueba para testear, hacer version control y hacerlo público
> - [x] **config** configurar el `.gitignore` para que no exista ningún compromiso de datos personales
> - [x] **feat** hacer la config segura contra errores
# Refactor
- [ ] mejorar la estructura de finance scope
- [ ] comprobar si se puede crear una tasklist con un array
- [ ] unificar parsings en un módulo coherente
- [ ] 
# Backlog

- [ ] Quitar planes como tarea y empezar a indexarlos como lista, no tiene sentido que sean tareas
- [ ] sección de limpieza basado en el libro de sidetracked home executives
- [ ] rollout pero únicamente de la sección tareas del día anterior mediante un hook de `templater`
- [ ] Proyectos **feat** función `archived done` para proyectos con mucas tareas, luego tendría que sumarse las tareas done con las tareas de next action. también podrían eliminarse o enviarlas al final del archivo si es un proyecto por fases y por ejemplo, se ha terminado dicha fase
 - [ ] Proyectos: **feat** agregar puntuación a las tasks, ya que no todas tienen igual impacto
 - [ ] Proyectos: **feat** agregar puntuación a las tasks, ya que no todas tienen igual impacto
- [ ] Proyectos **feat** propiedad de revisión (cada n días) para poder decir cómo evoluciona el proyecto, en caso de que un proyecto no tenga fin
 - [ ] Proyectos **feat** gráfico burndown
 - [ ] Finanzas **mejora ui** asociar un color a un gasto
 - [ ] general **config** tener un archivo json que escriba las opciones de configuración, a parte de las funciones normales
 - [ ] general **refactor** mejorar los tiempos de query escribiendo al final de cada mes la snapshot y calcular sobre ese checkpoint en vez de recalcular desde el inicio de los tiempos
 - [ ] Calendario **feat** tener íconos de planes personalizados según si pertenece a algún proyecto, se hará mediante el enlace a una página de proyectos desde la parte de planes p.e. `- [ ] Hackathon dia 1 [[proyectoX]]`
 - [ ] Proyectos **mejora-ui** cambiar el color de los proyectos según el estado (waiting, active, empty)
 - [ ] Proyectos **feat** filtrar proyectos en marcha (que no estén empty o finished)
 - [ ] Proyectos **feat** opción de que en el card pueda añadirse cuántos días hasta la deadline
 - [ ] Finanzas **feat** asignar un color en la celda de tipo según la tabla (o mejor aún, que sea en el formato etiqueta)
 - [ ] finanzas **feat** asignar un ícono al tipo y tener un tipo default, poner un tooltip para conocer más del tipo
- [ ] Personas **feat** Calcular el last-time-seen según la mención en la sección "planes"
  - [ ] Calendario **feat** mostrar el streak de hábitos al lado del nombre
  - [ ] Calendario **feat** añadir un botón que lance un hook de `templater` para poder asingar a planes no concretados una fecha
- [ ] Calendario: **feat** separar el track de gym para que enlace a la página hecha ese día
- [ ] Calendario: Añadir eventos que duren días, tipo, plazos para hacer x o y entrega, para poder visualizarlo en el calendario
- [ ] Finanzas **hotfix** diferenciar entre pago de deudas en efectivo y a la cuenta corriente, añadirle `#bizum` como etiqueta por defecto, y quitarla manualmente en caso de que el pago no se haga via bizum
- [ ] General **feat** pegar el apartado proyección semanal dentro del dashboard para que cada semana puedas tener tus metas claras
- [ ] Agregar un apartado de imágenes para poder ver las fotos de hace un año??
- [ ] Hacer el vault responsive a teléfono
- [ ] General **feat** definir una configuración idioma (en, es)
- [ ] General **feature** tener un pequeño apartado de bot de selenium (tiempo, filmoteca)
# Brainstorming
- Pensar sobre la parte del gym: guardar los datos, cómo generar las plantilas
- Definir una función que alterne entre colores legibles entre sí, si existe en el mismo gráfico dos colores iguales, o que son muy parecidos, o que combinan mal en legibilidad, alternar en otros
# Resources
- otro proyecto con dvjs https://github.com/702573N/Obsidian-Tasks-Calendar

