## Mapa de Riesgo Comunitario

## 1. Descripción del proyecto

Desarrollar una aplicación web llamada Mapa de Riesgo Comunitario, cuyo propósito es ayudar a los ciudadanos a identificar zonas vulnerables, consultar información sobre riesgos naturales, encontrar lugares de asistencia y conocer medidas de prevención ante situaciones de emergencia.

La plataforma debe permitir consultar información geográfica de diferentes partes del Perú, visualizar peligros, registrar reportes ciudadanos y localizar establecimientos que proporcionen ayuda durante desastres.

El proyecto debe desarrollarse con una arquitectura escalable, segura, organizada y preparada para incorporar nuevas funcionalidades.

## 2. Objetivos principales

- Identificar y visualizar zonas vulnerables ante huaicos, inundaciones, deslizamientos y otros peligros.
- Facilitar la consulta de rutas de evacuación y puntos seguros.
- Permitir localizar albergues, refugios, hospitales y centros de ayuda.
- Facilitar el registro de reportes ciudadanos.
- Proporcionar alertas y recomendaciones preventivas.
- Promover la participación comunitaria.
- Facilitar el acceso a información confiable sobre riesgos y emergencias.
- Contribuir a la prevención y adaptación ante el cambio climático.

## 3. Cobertura geográfica

La aplicación estará preparada para funcionar en todo el Perú.

La organización geográfica deberá contemplar:

- Departamentos.
- Provincias constitucionales, cuando corresponda.
- Provincias.
- Distritos.

Los usuarios podrán seleccionar una ubicación mediante filtros geográficos dependientes.

Al seleccionar una ubicación, el sistema mostrará la información disponible correspondiente a esa zona.

La arquitectura debe permitir incorporar nuevas ubicaciones sin modificar la estructura principal del sistema.

No se debe asumir que existen datos disponibles para todos los distritos.

## 4. Público objetivo

- Ciudadanos.
- Familias que viven en zonas vulnerables.
- Dirigentes y organizaciones vecinales.
- Personas que necesitan consultar información preventiva.
- Administradores encargados de gestionar la plataforma.

## 5. Tecnologías propuestas

### Frontend
- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Lucide React.

### Backend
- Next.js Route Handlers.
- TypeScript.
- Validación de datos en el servidor.

### Base de datos
- PostgreSQL + PostGIS.
- Drizzle ORM (en lugar de Prisma, por el soporte de PostGIS; ver `docs/adr/0001-decisiones-iniciales.md`).

### Mapas
- MapLibre GL JS (en lugar de Leaflet; ver ADR 0001).
- Datos de OpenStreetMap (mapa base OpenFreeMap; PMTiles propio para el modo sin conexión).
- GeoJSON para información geográfica.

### Herramientas adicionales
- Docker cuando sea necesario.
- Git y GitHub.
- PWA para funcionalidades sin conexión.

No cambiar las tecnologías principales sin justificar la necesidad y consultar previamente.

Cambios aprobados el 19-11-2026: PostGIS, Drizzle, MapLibre, stack de costo $0 y piloto en Huaraz e Independencia (Áncash). Detalle en `docs/adr/0001-decisiones-iniciales.md`. Next.js 16 tiene cambios incompatibles con versiones anteriores: leer `AGENTS.md` y la documentación en `node_modules/next/dist/docs/` antes de escribir código.

## 6. Módulos principales

### 6.1. Inicio
- Presentación de la plataforma.
- Acceso al mapa.
- Resumen de alertas.
- Recomendaciones preventivas.
- Información general.

### 6.2. Mapa de riesgos
- Mapa interactivo.
- Visualización de zonas vulnerables.
- Marcadores geográficos.
- Filtros por departamento, provincia y distrito.
- Filtros por tipo de peligro.
- Información detallada de cada zona.
- Fuentes y fechas de actualización.

### 6.3. Rutas de evacuación y puntos seguros
- Visualización de rutas.
- Ubicación de puntos seguros.
- Información de cada ubicación.
- Estado de verificación.
- Indicaciones para llegar.

No presentar rutas como seguras si no han sido verificadas.

### 6.4. Centros de ayuda y asistencia
Permitir localizar:

- Albergues temporales.
- Refugios habilitados.
- Centros de ayuda humanitaria.
- Centros de distribución de alimentos y agua.
- Hospitales y centros de salud.
- Puestos de atención médica.
- Centros de emergencia y rescate.

Mostrar dirección, ubicación, tipo de asistencia, contacto, horarios y disponibilidad cuando exista información verificada.

Diferenciar los puntos seguros de los establecimientos que proporcionan alojamiento o asistencia.

### 6.5. Reportes ciudadanos
Permitir registrar:

- Huaicos.
- Inundaciones.
- Deslizamientos.
- Acumulación de residuos.
- Drenajes obstruidos.
- Otros peligros.

Los reportes podrán incluir descripción, ubicación, coordenadas, fotografía y fecha.

Estados:

- Pendiente.
- En revisión.
- Verificado.
- Rechazado.

Los reportes no deben convertirse automáticamente en información oficial.

### 6.6. Alertas y notificaciones
- Alertas por ubicación.
- Tipo de peligro.
- Zona afectada.
- Fecha de publicación.
- Fuente.
- Recomendaciones.
- Estado de la alerta.
- Fecha de revisión o vencimiento.

### 6.7. Solicitudes de ayuda
Permitir registrar necesidades de asistencia, como:

- Agua.
- Alimentos.
- Medicamentos.
- Atención médica.
- Apoyo para evacuación.
- Otras necesidades.

Los administradores podrán revisar y gestionar las solicitudes.

### 6.8. Educación y prevención
- Prevención ante huaicos.
- Prevención ante inundaciones.
- Prevención ante deslizamientos.
- Preparación familiar.
- Mochila de emergencia.
- Cuidado ambiental.
- Recomendaciones ante olas de calor.

### 6.9. Panel de administración
- Gestión de usuarios y permisos.
- Revisión de reportes.
- Administración de alertas.
- Gestión de zonas de riesgo.
- Gestión de establecimientos de ayuda.
- Gestión de rutas y puntos seguros.
- Publicación de contenido.
- Registro de actualizaciones.
- Historial de actividades administrativas.

## 7. Confiabilidad de la información

Priorizar fuentes oficiales como:

- SIGRID.
- CENEPRED.
- INGEMMET.
- INDECI.
- Municipalidades.
- Instituciones responsables de los establecimientos registrados.

No inventar estadísticas, ubicaciones, rutas, establecimientos ni alertas.

Toda información relevante debe tener una fuente y fecha de actualización.

Los datos de prueba deben identificarse claramente como información ficticia.

Diferenciar información oficial, reportes ciudadanos y datos pendientes de verificación.

No afirmar que existen integraciones automáticas con instituciones si no se han comprobado sus mecanismos de acceso.

## 8. Seguridad y privacidad

- Validar datos en el cliente y servidor.
- Proteger las rutas administrativas.
- Implementar permisos por roles.
- Proteger información personal.
- Validar archivos e imágenes.
- Evitar inyecciones SQL y ataques XSS.
- No exponer credenciales.
- Aplicar límites de solicitudes.
- Evitar mostrar públicamente datos privados de los reportantes.

## 9. Funcionamiento sin conexión

Preparar la aplicación para ofrecer funcionalidades PWA.

Permitir consultar información previamente almacenada, como mapas descargados, contactos de emergencia, recomendaciones y ubicaciones previamente verificadas.

Mostrar siempre la fecha de actualización de la información almacenada.

No presentar información antigua como si estuviera actualizada.

## 10. Diseño y experiencia de usuario

La aplicación debe tener un diseño moderno, profesional y fácil de utilizar.

Características:

- Interfaz intuitiva.
- Diseño responsive.
- Prioridad a dispositivos móviles.
- Buena jerarquía visual.
- Tipografía legible.
- Contraste adecuado.
- Iconografía clara.
- Componentes reutilizables.
- Navegación sencilla.

El mapa debe tener un papel central en la experiencia de usuario.

Evitar interfaces saturadas, animaciones innecesarias y elementos decorativos que dificulten la consulta de información.

## 11. Organización del código

Mantener una arquitectura modular.

Separar correctamente:

- Componentes.
- Páginas y rutas.
- Servicios.
- Modelos.
- Validaciones.
- Tipos.
- Acceso a datos.
- Autenticación.
- Funcionalidades geográficas.

Evitar archivos demasiado grandes, duplicación de código y dependencias innecesarias.

## 12. Metodología de desarrollo

El proyecto debe desarrollarse progresivamente y mediante las siguientes etapas:

1. Análisis de requerimientos.
2. Planificación de arquitectura.
3. Diseño de estructura de carpetas.
4. Diseño de base de datos.
5. Configuración inicial del proyecto.
6. Desarrollo de interfaces.
7. Implementación de autenticación.
8. Implementación de módulos funcionales.
9. Integración de mapas y datos geográficos.
10. Implementación de seguridad.
11. Pruebas y optimización.
12. Preparación para despliegue.

No desarrollar todas las funcionalidades simultáneamente.

## 13. Reglas de trabajo para Claude Code

1. Leer este archivo antes de comenzar cualquier tarea.
2. Analizar la estructura existente antes de modificar archivos.
3. No comenzar a programar sin haber definido y aprobado la arquitectura.
4. Trabajar por etapas y funcionalidades.
5. No modificar decisiones arquitectónicas importantes sin consultar.
6. No instalar dependencias innecesarias.
7. Mantener actualizado el código y la documentación.
8. Ejecutar pruebas después de implementar cada funcionalidad.
9. Corregir errores antes de continuar.
10. No declarar funcionalidades terminadas sin comprobar su funcionamiento.
11. Explicar los cambios realizados y los archivos modificados.
12. Informar sobre problemas, limitaciones y decisiones pendientes.

## 14. Primera tarea al iniciar el proyecto

Al comenzar a trabajar en este proyecto, tu primera tarea será exclusivamente analizar y planificar.

Debes:

1. Leer completamente este archivo.
2. Analizar los objetivos y funcionalidades.
3. Evaluar la arquitectura tecnológica propuesta.
4. Identificar riesgos técnicos y posibles dificultades.
5. Proponer una estructura de carpetas.
6. Diseñar una propuesta inicial de base de datos.
7. Identificar dependencias y posibles integraciones externas.
8. Organizar las fases de desarrollo.
9. Recomendar mejoras cuando detectes problemas en los requerimientos.

No crear archivos de código, no instalar dependencias y no modificar el proyecto durante esta primera etapa.

Presenta el análisis y espera mi aprobación antes de comenzar la implementación.

Si encuentras contradicciones, requisitos inviables o decisiones técnicas que puedan perjudicar el proyecto, debes señalarlos antes de continuar.