# versión 0.1
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
> - [x] Quitar planes como tarea y empezar a indexarlos como lista, no tiene sentido que sean tareas

> [!NOTE]+ Finanzas
> - [x] Finanzas **bug** al cambiar de vista se regenera mal los panes de financecharts
> - [x] Finanzas: **feat** añadir espacio de efectivo, para controlar más los gastos en efectivo, ya que se ofusca la trazabilidad de la cuenta
> - [x] Finanzas: **feat** conseguir enlazar las páginas al día
> - [x] Finanzas: **bugfix** no se puede poner más de una etiqueta por defecto
> - [x] Finanzas: **mejora-ui** quitar deudas del recuadro, pero añadir un apartado cuentas que tenga ahorro, corriente y efectivo stacked
> - [x] general **refactor** mejorar los tiempos de query escribiendo al final de cada mes la snapshot y calcular sobre ese checkpoint en vez de recalcular desde el inicio de los tiempos

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