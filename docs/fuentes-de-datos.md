# Fuentes de datos — Piloto

> **Cambio de piloto (19-11-2026):** el piloto pasa a ser **Huaraz e Independencia (Áncash)**. Es la única zona del Perú donde se encontraron zonas seguras y rutas de evacuación oficiales y recientes (mayo de 2025). Ver la **sección 10**. Las secciones 1 a 9 documentan Lurigancho-Chosica, que queda como candidato para una expansión futura.

> Fase 0 del proyecto *Mapa de Riesgo Comunitario*. Revisión realizada el **19-11-2026**.
> Este documento registra qué datos existen realmente, cómo se accede a ellos y con qué licencia.
> Ningún dato de este documento ha sido importado todavía a la aplicación.

## Leyenda de estado

| Marca | Significado |
|---|---|
| **[V]** | Verificado: el enlace/servicio respondió y se comprobó su contenido |
| **[M]** | Mencionado: aparece en buscadores o terceros, no se comprobó |
| **[NE]** | No encontrado |

## Zona piloto

- **Distrito:** Lurigancho (Chosica), provincia y departamento de Lima.
- **Ubigeo INEI:** `150118` [V] (no confundir con San Juan de Lurigancho, `150132`). Confirmar contra el atributo del GPKG oficial al importar.
- **Bbox aproximado usado en consultas:** `-76.85,-12.05,-76.55,-11.85` (lon/lat, EPSG:4326).
- **Expansión prevista:** Chaclacayo y Santa Eulalia (cuenca del Rímac).

---

## 1. Límites territoriales y ubigeo

| Fuente | Acceso | Formato | Fecha | Licencia | Estado |
|---|---|---|---|---|---|
| INEI – IDE | https://ide.inei.gob.pe/ → `files/Departamento.rar`, `files/Provincia.rar`, `files/Distrito.rar` | GeoPackage en .rar | "a 2023" | No indicada | [V] |
| PNUD (copia de INEI) | https://geosmarthosting.undp.org/arcgis/rest/services/Hosted/Distritos_INEI_2025_IDE_2024/FeatureServer | ArcGIS REST | 2024/2025 | No indicada | [V] — solo para validar |

**Notas**
- INEI advierte que las capas "pueden contener diferencias o inconsistencias"; GeoPerú las califica como "referenciales". La app debe indicarlo.
- Ubigeo INEI y RENIEC **no son equivalentes**. Usar siempre INEI como clave. Tabla no oficial de equivalencias: https://github.com/jmcastagnetto/ubigeo [M].

---

## 2. Peligros naturales (núcleo del MVP)

### 2.1 INGEMMET – GEOCATMIN ⭐ fuente vectorial principal

Servidor: https://geocatmin.ingemmet.gob.pe/arcgis/rest/services (ArcGIS 10.91) [V]. Admite `query` con `f=geojson`, máximo 2000 registros por consulta, EPSG:4326. También expone WMS.

| Servicio / capa | Contenido | Elementos en bbox | Estado |
|---|---|---|---|
| `SERV_PELIGROS_GEOLOGICOS/MapServer/0` | Inventario de peligros geológicos (puntos). 243 con `NM_DIST='Lurigancho'`. Código `1000\|1500\|1504` = flujo de detritos (313 en bbox) | 485 | [V] |
| `SERV_PELIGROS_GEOLOGICOS/MapServer/2` | **Zonas críticas**: paraje, tipo de peligro, recomendación, boletín ("Peligros geológicos en Lima Este") | 33 (25 en Lurigancho) | [V] |
| `SERV_PELIGROS_GEOLOGICOS/MapServer/1, 6, 7` | Otros peligros / cartografía de peligros | 99 / 137 / 361 | [V] (no analizados a fondo) |
| `SERV_SUSCEPTIBLE_MOV_MASA_REGIONAL/MapServer/1` | Polígonos de susceptibilidad a movimientos en masa (`GRIDCODE`, `LEYENDA`) — estudio **regional** | 6715 | [V] — escala no indicada |
| `SERV_SUSCEPTIBILIDAD_INUNDACION_FLUVIAL_MIL1` | Susceptibilidad a inundación fluvial (el nombre sugiere escala 1:1 000 000) | — | [M] |

- Código `1000|1100|1102` (152 puntos): probablemente caídas; **confirmar en el dominio de la capa** antes de etiquetar.
- El servicio se describe como "Peligros Geológicos del Perú – Feb 2013", aunque contiene registros posteriores.
- **Licencia:** GEOCATMIN no expone licencia legible en el servicio. Los mismos datos están en Datos Abiertos con **ODC-BY** (ver 2.2); citar esa fuente.

**Documentos técnicos INGEMMET**
- Informe A6680 – Evaluación geodinámica de quebradas Rayos de Sol, Quirio (Chosica) y Cashahuacra, evento del 23-03-2015: https://repositorio.ingemmet.gob.pe/handle/20.500.12544/1310 [V]
- Eventos históricos de Quirio y Pedregal: https://app.ingemmet.gob.pe/biblioteca/pdf/BSGP-111-78.pdf [M]
- Documento sobre quebrada Pedregal: https://app.ingemmet.gob.pe/biblioteca/pdf/CPG20-593.pdf [M]

### 2.2 Plataforma Nacional de Datos Abiertos ⭐ licencia clara

Licencia declarada: **Open Data Commons Attribution (ODC-BY)** [V].

| Dataset | Archivo | Actualización | Estado |
|---|---|---|---|
| Inventario de peligros geológicos (INGEMMET) | https://www.datosabiertos.gob.pe/sites/default/files/Inventario%20de%20peligros%20geol%C3%B3gicos_Junio2026.csv | 30-06-2026 | [V] |
| Zonas críticas por peligros geológicos (INGEMMET) | https://www.datosabiertos.gob.pe/sites/default/files/Zonas%20cr%C3%ADticas_Junio2026.csv | 30-06-2026 | [V] — separador `;`, codificación no UTF-8 (probable Latin-1), con lat/long |
| Emergencias históricas registradas por INDECI | ZIP por año | 15-09-2026 | [V] |

- La API CKAN (`/api/3/action/package_search`) responde 418: la descarga será manual o por URL directa.

### 2.3 ANA – fajas marginales y cauces

Servidor: https://geosnirh.ana.gob.pe/server/rest/services (ArcGIS 11.3) [V]. Licencia **no indicada**.

| Servicio / capa | Contenido | Elementos en bbox | Estado |
|---|---|---|---|
| `Público/FajaMarginal/MapServer/127` | Hitos de faja marginal con resolución y fecha | 3715 | [V] |
| `ONRH/Limites_Fajas_Marginales_Consolidado/MapServer/117` | Líneas de límite de faja marginal | 167 | [V] |
| `ws_Rios_Quebradas/MapServer/37` | Red hidrográfica (Pfafstetter), 2018 | — | [V] |
| Carpeta `Puntos_Criticos/` | Puntos críticos 2022-2023 (DU 015-2023), barreras dinámicas | — | [M] (no consultado) |

Quebradas de Lurigancho con faja marginal aprobada (resolución directoral): Quirio (RD 2256-2015), Pedregal (RD 2070-2015), Carosio (RD 2058-2015), La Libertad (RD 2059-2015), La Ronda 01-03 (RD 714-2021), Huaycoloro (RD 0375-2019), además de Corrales–Rayos de Sol, Yanacoto, Mariscal Castilla, California, Chacrasana, Vallecito, Santo Domingo y La Cantuta (2015-2025). Río Rímac: RD 0077-2020 y RD 1246-2022.

> Relevante para la consulta por ubicación: la faja marginal delimita un área asociada al cauce. **Pendiente verificar** el marco legal exacto sobre construcción en faja marginal antes de mostrar cualquier mensaje al respecto.

### 2.4 CENEPRED – SIGRID

- **Servicios SIG:** `https://sigrid.cenepred.gob.pe/arcgis/rest/services` solo expone `sigrid/sigrid_collect` (sin peligros). `Cartografia_Peligros` e `Informacion_CENEPRED` responden "not found". `/geoserver/ows` → 404. **No hay capas SIG utilizables** [V].
- **Evaluaciones de riesgo (EVAR), en PDF** — listado en https://sigrid.cenepred.gob.pe/sigridv3/evar, descarga `.../sigridv3/documento/{id}/descargar` [V]:

| ID | Peligro | Ámbito |
|---|---|---|
| 1610 | Flujo de detritos | Quebradas Carossio y Libertad |
| 4121 | Flujo de detritos | Quebrada Huaycoloro |
| 6441 | Flujo de detritos | CP Lurigancho (quebrada) |
| 6443 | Inundación fluvial | Sector Lurigancho Río |
| 17171, 17172 | Flujo de detritos | Quebradas Santo Domingo y Cantuta (UNE La Cantuta) |
| 17322 | Sismo | UNE La Cantuta |
| 21376 | Flujo de detritos | Quebrada Vizcachera |

- No se encontraron EVAR de Quirio, Pedregal ni La Ronda.
- **Licencia:** no publicada.
- Uso previsto: respaldo documental enlazado desde la ficha de cada quebrada. Digitalizar sus mapas sería trabajo manual y debe marcarse como "digitalizado por el proyecto a partir de EVAR n.º X".

### 2.5 SENAMHI e INDECI (alertas)

- **SENAMHI:** sin RSS, CAP ni API documentada. GeoServer de la IDE: `https://idesep.senamhi.gob.pe/geoserver/ows` [V] (AccessConstraints: NONE). Capas de interés:
  - `g_aviso:view_aviso` — aviso meteorológico (WFS GeoJSON funciona).
  - `g_04_08:*` — peligro de movimientos en masa por lluvias intensas a 24-168 h (WFS GeoJSON funciona).
  - `g_aviso:view_aviso_v2`, `g_acti_quebrada:view_av_activ_qdra` — no funcionan.
  - **Sin contrato de servicio: puede cambiar sin aviso.** No se debe presentar como integración oficial.
- **INDECI / COEN:** sin feed legible por máquina [NE]; reportes en PDF. SINPAD no verificado [M].

---

## 3. Establecimientos y puntos de asistencia

| Tipo | Fuente | Formato | Fecha | Licencia | Estado |
|---|---|---|---|---|---|
| Salud | RENIPRESS (SUSALUD): https://www.datosabiertos.gob.pe/dataset/registro-nacional-de-entidades-prestadoras-de-servicios-de-salud-renipress | CSV mensual + diccionario, **con latitud/longitud** | 30-10-2026 | ODC-BY | [V] ⭐ |
| Salud (alternativa) | https://www.datosabiertos.gob.pe/sites/default/files/RENIPRESS.csv | CSV, coordenadas Norte/Este (UTM probable) | 09-2025 | No indicada | [V] |
| Comisarías | MININTER "Ubica tu Comisaría": https://aplicaciones.mininter.gob.pe/ubicatucomisaria/ | Solo visor | — | — | [V] sin descarga |
| Bomberos | — | — | — | — | [NE] |
| Albergues, zonas seguras, puntos de reunión, rutas de evacuación | — | — | — | — | [NE] como dato abierto |

**Documentos (PDF) sobre evacuación en Chosica**
- Mapa de rutas de evacuación y zonas seguras, AAHH La Libertad (ANA, 2015): SIGRID documento 1594 [M].
- Cartillas PREDES: https://predes.org.pe/wp-content/uploads/2017/06/Cartillas-4-acciones-CHOSICA-WEB.pdf [M].
- PPRRD Lurigancho-Chosica 2022-2025: SIGRID documento 14006 [V] y https://www.gob.pe/institucion/munilurigancho/informes-publicaciones/4391759-plan-de-prevencion-y-reduccion-del-riesgo-del-desastres-del-distrito-de-lurigancho-chosica-periodo-2022-2025 [V].
- Plan Climático Local 2025-2030 (borrador): https://munichosica.pe/wp-content/uploads/2025/12/2-Plan_Climatico_Lurigancho_Chosica.pdf [M].

---

## 4. OpenStreetMap

Consulta Overpass en el área administrativa "Lurigancho" (admin_level 8) [V]:

- 2 hospitales (incl. Hospital José Agurto Tello), 14 clínicas/centros de salud, 11 consultorios.
- 2 compañías de bomberos (Chosica N.º 32, Huachipa N.º 236).
- ~4 comisarías PNP y puestos de serenazgo.
- 162 tramos `waterway=stream`, 3 `river`. Pocas quebradas con nombre.
- **Puntos de reunión y refugios** (consulta del 19-11-2026) [V]:
  - `emergency=assembly_point`: **0**.
  - `social_facility=shelter`: **0**.
  - `amenity=shelter`: 2, que no son refugios de emergencia (una es una glorieta).
  - Infraestructura que podría servir de refugio: 148 colegios, 11 centros deportivos (por ejemplo, Estadio Martín Yupanqui, Coliseo Carmela Estrella) y 1 complejo cultural municipal.
  - Uso: **solo interno**, como candidatos a verificar; nunca publicarlos como albergues. Antes de proponerlos hay que cruzarlos con las capas de peligro, porque algunos pueden estar en un cauce.
- Se descartó **Google Maps / Places**: es de pago a partir de su cuota, sus condiciones impiden guardar los datos y mostrarlos sobre un mapa que no sea de Google, y no tiene designaciones oficiales ("albergue" devuelve hostales).

**Licencia ODbL:** atribución "© OpenStreetMap contributors". Si se publica una base de datos que **mezcle** OSM con otras fuentes, esa base queda bajo ODbL (share-alike). → **Mantener los datos OSM en tablas/capas separadas** de los datos oficiales.

---

## 5. Contactos de emergencia

| Número | Servicio | Fuente | Estado |
|---|---|---|---|
| 105 | Policía Nacional | El Peruano, 18-09-2026: https://elperuano.pe/noticia/305020-del-105-al-911-gobierno-avanza-hacia-un-sistema-integrado-para-atender-emergencias-mas-rapido | [V] |
| 106 | SAMU | Ídem | [V] |
| 116 | Bomberos | Ídem | [V] |
| 115 | Defensa Civil | Fragmento de https://www.gob.pe/547 (no se pudo abrir) | [M] — no mostrar hasta verificar |
| 911 | Central única | Ídem El Peruano: **aún no operativo** | Revisar periódicamente |

Cada número debe mostrarse con su fuente y fecha de verificación.

---

## 6. Marco legal relevante

- **Ley 29869** (29-05-2012) — Reasentamiento poblacional para zonas de muy alto riesgo no mitigable. **Art. 21:** "Está prohibido ocupar zonas declaradas de muy alto riesgo no mitigable para fines de vivienda o cualquier otro que ponga en riesgo la vida o integridad de las personas." [V] https://busquedas.elperuano.pe/dispositivo/NL/794288-2
  - Modificada por Ley 30645 (2017): zona de riesgo recurrente por huaicos; declaración de zona "intangible e inhabitable" por el gobierno local [M].
  - Reglamento: D.S. 142-2021-PCM [M].
- **Ley 29733** (Protección de Datos Personales). Reglamento vigente: **D.S. 016-2024-JUS**, publicado el 30-11-2024, vigente desde el 31-03-2025; deroga el D.S. 003-2013-JUS [V por varias fuentes].

---

## 7. Consecuencias para el plan

1. **No existen polígonos oficiales de riesgo a escala local para Chosica en formato SIG.** Lo disponible es:
   - Puntos de inventario y zonas críticas (INGEMMET).
   - Polígonos de susceptibilidad **regional** (INGEMMET), no aptos para decidir sobre un lote.
   - Fajas marginales y cauces (ANA).
   - EVAR en PDF (CENEPRED).
2. **Ajuste del modelo de datos:** la tabla `risk_zones` (solo polígonos) se reemplaza por **`hazard_features`** con geometría genérica (punto, línea o polígono) y una `categoria` (`inventario`, `zona_critica`, `susceptibilidad`, `faja_marginal`, `cauce`). Cada registro pertenece a un **`dataset`** con fuente, licencia, fecha, escala y polígono de cobertura.
3. **Consulta por ubicación:** el resultado se construirá combinando:
   - nivel de susceptibilidad regional (con advertencia de escala);
   - eventos inventariados y zonas críticas cercanas (radio configurable);
   - cercanía a cauces y fajas marginales;
   - EVAR disponibles de la quebrada más cercana (enlace al PDF).

   Nunca se mostrará "seguro".
4. **Importación:** snapshots mediante scripts ETL (consultas paginadas a ArcGIS REST en GeoJSON y CSV de Datos Abiertos). La app **no dependerá en vivo** de servicios gubernamentales.
5. **Alertas:** no hay feed oficial estable. Las alertas serán manuales en una fase posterior; las capas de SENAMHI solo podrían usarse como capa informativa, sin presentarlas como integración oficial.
6. **Albergues, zonas seguras y rutas:** no hay datos abiertos. Opciones:
   - Solicitar formalmente la información a la Subgerencia de GRD de la Municipalidad de Lurigancho-Chosica (vía Ley de Transparencia o carta académica).
   - Digitalizar manualmente desde los PDF, marcando la fuente y el estado "pendiente de verificación".
   - Las rutas no se publicarán hasta estar verificadas.

## 8. Pendientes

- [ ] Confirmar ubigeo 150118 en el GPKG oficial de INEI.
- [ ] Confirmar el significado del código `1000|1100|1102` en el dominio de la capa INGEMMET.
- [ ] Determinar la escala del estudio de susceptibilidad regional de INGEMMET.
- [ ] Verificar el número 115 en una fuente oficial.
- [ ] Revisar el contenido del mapa de evacuación de 2015 (SIGRID documento 1594).
- [ ] Verificar el marco legal sobre construcción en faja marginal.
- [ ] Licencias no indicadas (INEI, ANA, CENEPRED): para un uso académico con atribución el riesgo es bajo; confirmar si el proyecto se publica.
- [ ] Buscar otros mapas de la serie ANA/INDECI de 2015 ("LIMA nn") para otras quebradas de Chosica.
- [ ] Solicitar a la Subgerencia de GRD de la municipalidad las zonas seguras y rutas de evacuación vigentes.

---

## 9. Revisión de PDF en busca de zonas seguras (19-11-2026)

| Documento | Fecha | Antigüedad | ¿Zonas seguras ante huaicos? | Detalle |
|---|---|---|---|---|
| **Mapa de rutas de evacuación – Quebrada La Libertad** (ANA + INDECI/CEPIG), SIGRID doc. 1594, mapa "LIMA 34" | Setiembre 2015 | **~11 años** | ✅ **Sí, 2 zonas** | Escala 1:2 200, WGS84 UTM 18S, sobre imagen satelital. Zonas: "Zona de refugio" (0,04 ha) y "Parque Echenique" (0,01 ha). Incluye rutas de evacuación y zona inundable (referencial). AAHH La Libertad: 356 viviendas en riesgo y 1 426 habitantes. **Solo cubre ese asentamiento humano.** Se puede digitalizar con las coordenadas UTM del marco. |
| **PPRRD Lurigancho-Chosica 2022-2025** (Subgerencia de Defensa Civil), SIGRID doc. 14006, 146 páginas | Título 2022-2025; datos del Censo 2017, resoluciones de 2019 y metas 2021-2023 | ~4-5 años; **periodo vencido** (2025) | ❌ **No** | 0 menciones a "zona segura", "evacuación" o "refugio". Incluye 17 almacenes de ayuda humanitaria (solo direcciones), compañías de bomberos, comisarías y la caracterización de las quebradas Santa María, Quirio, Pedregal, Carossio y Corrales. El texto indica que la aprobación oficial estaba pendiente; **no se confirmó que se aprobara**. No se encontró un plan posterior. |
| **Plan Climático Local 2025-2030** (municipalidad) | Diciembre 2025 | ~1 año | ❌ No | Borrador de 2 páginas "en proceso de aprobación"; solo da lineamientos generales. |
| **Cartilla "4 acciones" ante huaicos e inundaciones** (PREDES) | 1.ª impresión abril 2016; 3.ª mayo 2017 | ~9,5 años | ❌ No | Material educativo. Dice que las zonas seguras las determinan "los técnicos de Defensa Civil de tu distrito". Trae una cronología de eventos (1987, 1998, 2012, 2015, 2017) y un mapa de riesgos en imagen sin georreferenciar. Sus teléfonos locales son de 2016: **no usarlos**. |

**Conclusión:** solo existe **un documento oficial con zonas seguras ante huaicos**. Tiene unos 11 años y cubre un solo asentamiento humano (La Libertad), con 2 zonas pequeñas. Si se publica, debe llevar el aviso "Según mapa ANA/INDECI de setiembre de 2015 – vigencia no verificada". La numeración "LIMA 34" sugiere que existe una serie de mapas de 2015 que podría cubrir otras quebradas; queda pendiente buscarla. La fuente principal de zonas seguras actuales tendrá que ser la municipalidad.

---

## 10. Comparación nacional y nuevo piloto: Huaraz e Independencia (19-11-2026)

### 10.1 Criterio de selección

El piloto debe tener **zonas seguras y rutas de evacuación oficiales y recientes**. Las capas nacionales (INGEMMET, ANA, INEI, RENIPRESS) existen en todo el país, así que no sirven para diferenciar candidatos.

Clasificación de las fechas:
- **Reciente:** 2022 o después.
- **Aceptable:** 2020-2021.
- **Antiguo:** antes de 2020.

### 10.2 Resultado de la búsqueda

| Zona | Zonas seguras | Peligro reciente | Veredicto |
|---|---|---|---|
| **Huaraz e Independencia (Áncash)** | ✅ **Mayo 2025**, oficiales, muchas y clasificadas | EVAR de diciembre de 2020 (aceptable) y mapa de 2025 | **Elegido** |
| Santa Cruz de Cocachacra (Huarochirí) | ⚠️ Diciembre 2024: "zonas seguras preliminares" **para albergues**, sin rutas (INDECI/CONIDA, SIGRID doc. 18992) | PPRRD 2025-2030 | Alternativa débil |
| Castilla (Piura) | ❌ Ninguna. Según UDEP (octubre 2026), todavía están "pendientes" | IGP, octubre 2025 (inundación de la quebrada El Gallo) | Sin zonas seguras |
| El Porvenir (Trujillo) | ⚠️ Solo el mapa ANA de 2015 | EVAR por huaico de agosto de 2025 | Igual que Chosica |
| Lurigancho-Chosica | ⚠️ Mapas ANA de 2015 (docs. 1594 y 1597) | Varias EVAR e informes INGEMMET 2023-2025 | PPRRD 2026-2030 escaneado (doc. 21326), contenido no revisado |
| Arequipa (Paucarpata, Mariano Melgar) | Solo para **peligro volcánico** (IGP 2022 y 2025) | — | No aplica a huaicos |
| Cusco, Machupicchu, Santa Teresa | ❌ | INGEMMET 2020-2021 | Descartado |

**Ningún candidato** tiene zonas seguras en formato SIG descargable: en todos los casos hay que digitalizar desde PDF o pedir los shapefiles.

Existe una serie nacional ANA de **149 mapas** de rutas de evacuación (2015-2016), toda antigua.

### 10.3 Fuentes de Huaraz e Independencia

**Zonas seguras y evacuación**
- **Mapa de zonas seguras y rutas de evacuación ante aluviones en Huaraz e Independencia – Zona baja, subcuenca del río Quillcay** [V].
  - Fecha: **mayo 2025**.
  - Autores: equipo OGRDyDC, INAIGEM y municipalidades de Huaraz e Independencia.
  - Escala 1:8 500, UTM zona 18 Sur. Fuentes del mapa: INAIGEM, MTC, ANA y la base catastral de las dos municipalidades.
  - Contenido:
    - niveles de peligro (muy alto, alto, medio y bajo) en el cono aluviónico;
    - rutas de evacuación priorizadas;
    - zonas de seguridad, refugios temporales, atención prehospitalaria y hospitalaria, puestos de comando, centros de acopio, atención de animales y gestión de cadáveres;
    - puentes del cono aluviónico y puentes alternativos.
  - Ficha: https://sinia.minam.gob.pe/mapas/mapa-zonas-seguras-rutas-evacuacion-ante-aluviones-huaraz-independencia
  - PDF: https://sinia.minam.gob.pe/sites/default/files/archivos/public/docs/MAPA%20DE%20ZONAS%20SEGURAS%20Y%20RUTAS%20DE%20EVACUACI%C3%93N_FIN.pdf
  - Acta e informe [M]: https://sinia.minam.gob.pe/sites/default/files/archivos/public/docs/R48306-mapa-informe-acta.pdf
  - **Formato: solo PDF.** Cobertura: **zona baja de la subcuenca Quillcay**, no el distrito completo.
- Versión anterior: mapa de diciembre de 2016, atribuido a la Universidad de Texas (antiguo, solo como referencia) [V].

**Riesgo**
- EVAR del INAIGEM, "Evaluación del riesgo por aluvión en la ciudad de Huaraz", **diciembre 2020** [V]: https://sigrid.cenepred.gob.pe/sigridv3/storage/biblioteca/11763_evaluacion-del-riesgo-por-aluvion-en-la-ciudad-de-huaraz-distritos-de-huaraz-e-independencia-provincia-de-huaraz-departamento-de-ancash.pdf
- Sistema de alerta temprana de la laguna Palcacocha (INAIGEM) [M].

**Capas nacionales verificadas para Huaraz** (bbox aproximado `-77.58,-9.56,-77.46,-9.46`) [V]:

| Capa | Elementos |
|---|---|
| INGEMMET – inventario de peligros geológicos | 36 |
| INGEMMET – zonas críticas | 6 |
| INGEMMET – susceptibilidad regional (polígonos) | 1 320 |
| ANA – hitos de faja marginal (cuenca Santa) | 574 |

**Ubigeo INEI** (vía capa PNUD/INEI) [V]:
- Huaraz `020101` (población 2024: 70 876).
- Independencia `020105` (población 2024: 93 922).

**RENIPRESS:** es un dataset nacional; falta filtrar por estos ubigeos.

### 10.4 Consecuencias para el plan

1. **Nuevo tipo de peligro: `aluvión`.** Se agrega como un registro más en el catálogo `hazard_types`, sin cambiar la estructura.
2. **Digitalización necesaria.** Georreferenciar el PDF con QGIS (gratuito) usando la cuadrícula UTM y digitalizar las zonas, rutas y niveles de peligro. Como es información de seguridad, **una persona debe validar** cada elemento.
3. **Pedir los shapefiles originales** al INAIGEM o a la OGRDyDC. El mapa se hizo en SIG, así que los archivos existen. Una solicitud académica (o por Ley de Transparencia) evitaría digitalizar y daría más precisión.
4. **Refugios temporales:** este mapa sí los trae como designación oficial. Hay que decidir si se incluyen, ya que antes se excluyeron solo por falta de datos.
5. **Limitación que hay que comunicar:** el mapa cubre el **escenario de aluvión** en la zona baja del Quillcay. Para otros peligros (huaicos en otras quebradas, lluvias) solo están las capas nacionales.

### 10.5 Pendientes de Huaraz

- [ ] Leer el acta e informe R48306 (metodología, validación, vigencia).
- [ ] Revisar la escala y los mapas del EVAR de 2020.
- [ ] Solicitar los shapefiles al INAIGEM o a la OGRDyDC.
- [ ] Filtrar RENIPRESS por los ubigeos 020101 y 020105.
- [ ] Verificar los contactos de emergencia locales (municipalidades, COE) con fuente oficial.

### 10.6 Validación oficial y búsqueda de los datos originales (19-11-2026)

- **Validación [V]:** el mapa fue **APROBADO** por la Plataforma Provincial de Defensa Civil de Huaraz en su II Sesión Ordinaria del **26-05-2025**. El acta está notariada. Participaron el INAIGEM, el INDECI, la Defensoría del Pueblo, la PNP, el Ministerio Público, la UGEL y alcaldes distritales. En el acta, el INAIGEM **recomienda actualizarlo nuevamente en 2026**: hay que revisar si sale una versión nueva.
- **Envío al MINAM [V]:** Informe N.° 000441-2026-MPHZ/GM-OGRDYDC (28-08-2026) y Oficio N.° 000404-2026-MPHZ/A (02-09-2026), en los que la municipalidad pide su publicación oficial.
- **Carpeta pública de Google Drive** citada en el informe: https://drive.google.com/drive/folders/1cgimWziM_sfPdWUT8Ej0X10i3WYn9jjL [V]. Solo contiene el mapa en PDF y en **PNG de 3508 × 2480 px**. Ese PNG tiene el doble de resolución que la versión de SINIA y es la mejor base para digitalizar.
- **Shapefiles / GeoJSON:** [NE]. No están publicados en SINIA, Drive, SIGRID ni INAIGEM. El PDF es **raster**: exportado desde ArcMap 10.5 el 25-06-2025, sin geometría vectorial que se pueda extraer.
- **Contacto para pedirlos:** Oficina de Gestión del Riesgo de Desastres y Defensa Civil (OGRDyDC) de la Municipalidad Provincial de Huaraz, jefa Ing. Yanet Vaneza Meza Nieto, o el INAIGEM.

### 10.7 Digitalización realizada (19-11-2026)

El proyecto digitalizó el mapa oficial a partir de la imagen PNG de 3508 × 2480 píxeles, georreferenciada con la grilla UTM 18S de su marco. Procedimiento y resultados: [scripts/etl/README.md](../scripts/etl/README.md).

**Resultados:**
- `data/processed/huaraz/zonas_peligro.geojson`: 4 niveles de peligro.
- `data/processed/huaraz/zonas_seguras.geojson`: 36 puntos de 7 tipos.
- `data/processed/huaraz/flechas_evacuacion.geojson`: 169 flechas de evacuación.

**Validación:**
- Residuo del ajuste a la grilla: 0,64 m.
- Plaza de Armas: 12 m respecto de OpenStreetMap.
- Río Quillcay: menos de 2 m de desplazamiento medio respecto de OpenStreetMap.

**Estado:** todos los elementos están marcados como `pendiente_revision_humana`. Las zonas seguras y las rutas de evacuación no deben publicarse hasta que una persona las revise.

### 10.8 Peligros geológicos del INGEMMET descargados para Huaraz (19-11-2026)

Script: `scripts/etl/ingemmet_descargar.py`, bbox `-77.60,-9.58,-77.44,-9.44`. Usa `curl` porque el servidor de GEOCATMIN envía una cadena de certificados incompleta.

| Capa | Archivo | Elementos | Fechas |
|---|---|---|---|
| Cartografía de peligros (**polígonos con extensión real**) | `ingemmet_cartografia_areas.geojson` | 85: 35 deslizamientos rotacionales, 33 erosiones en cárcava, 14 flujos de detritos, 3 derrumbes | Informes A7607 (Ichoca, marzo 2025), A7375 (Llactash, abril 2023) y A7315 (Chua Bajo, noviembre 2022) |
| Inventario (puntos) | `ingemmet_inventario_puntos.geojson` | 56 | 50 de 2007 y 6 de 2021-2026 |
| Otros peligros (puntos) | `ingemmet_otros_peligros_puntos.geojson` | 47: erosión de ladera y erosión fluvial | 46 de 2007 y 1 de 2023 |
| Zonas críticas (puntos) | `ingemmet_zonas_criticas_puntos.geojson` | 7 | Sin fecha en el servicio |

**Regla:** solo los polígonos se muestran como "zona". Los puntos son eventos de los que solo se conoce la ubicación: **no se les dibuja un área inventada**. En el visor aparecen como marcadores con la nota "extensión no medida".

### 10.9 Frecuencia de emergencias (INDECI) y cauces del centro de Huaraz (19-11-2026)

**INDECI – "Emergencias históricas registradas por el INDECI"** ([datosabiertos.gob.pe](https://www.datosabiertos.gob.pe/dataset/emergencias-hist%C3%B3ricas-registradas-por-el-indeci), licencia ODC-BY):
- Lista archivos de 2003 a 2018, pero **los enlaces de 2003-2006 y 2008-2018 devuelven 404** [V]. Solo funciona `Emergencias_2007.zip` (shapefile), guardado en `data/raw/indeci/`.
- **2007, Huaraz (020101) + Independencia (020105): 40 emergencias.**
  - Incendios: 17.
  - Lluvias intensas: 16.
  - Vientos fuertes: 3.
  - Granizo: 3.
  - Derrumbes: 1.
- Las de lluvia se concentran entre diciembre y abril.
- Un solo año no basta para medir frecuencia. **Pendiente:** pedir al INDECI o a la municipalidad los registros de SINPAD 2019-2026 por distrito.

**Cauces del centro de Huaraz:**
- La ANA solo tiene faja marginal aprobada del río Santa (2019) y de las quebradas Cancariaco (2024) y Huapish (2025). **No la tiene para el río Quillcay ni para el Río Seco.**
- El INGEMMET registra como zonas críticas por flujo de detritos la "Quebrada Quillcay y nevado Cojup" y la "Quebrada Río Seco".
- Según el acta del 26-05-2025, el INAIGEM estudia mapas de riesgo del Río Seco y del Río Casca. Aún no están publicados.
- **Conclusión:** no hay un estudio oficial publicado que delimite la extensión de un huaico en el centro de Huaraz. Que no aparezca una zona roja **no significa que no haya peligro**.

### 10.10 Capas para "Lluvias intensas" y "Huaico" (19-11-2026)

- **Susceptibilidad a movimientos en masa – INGEMMET:** servicio `SERV_SUSCEPTIBLE_MOV_MASA_REGIONAL/1`, mapa geomorfológico regional de la Dirección de Geología Ambiental.
  - 2579 polígonos en el área: 125 muy alta, 922 alta, 630 media, 823 baja y 79 muy baja.
  - Archivo: `ingemmet_susceptibilidad_mov_masa.geojson`. El servidor limita las respuestas a 1000 registros, así que se descarga por lotes de identificadores.
  - **Escala regional:** describe zonas, no lotes.
- **Cauces – OpenStreetMap (ODbL):** `scripts/etl/osm_cauces.py` → `osm_cauces.geojson`.
  - 52 tramos, 7 de ellos ríos.
  - Con nombre: Río Quilcay, Río Santa, Río Paria, Río Isku y las quebradas Cojup, Llaca, Quilcayhuanca y Rajucolta.
  - **El Río Seco y el Río Casca no tienen nombre en OSM.**
  - Se muestran como "camino natural de huaicos", **sin dibujar una franja de peligro**, porque no existe un estudio oficial que la delimite.

### 10.11 Inundación por lluvias en la ciudad – Municipalidad de Huaraz (19-11-2026)

**Fuente [V]:** "Plan del Programa Anual de Actividades del Grupo de Trabajo para la GRD, año 2025", anexo de la Resolución de Alcaldía N.° 59-2025-MPH/A, aprobado el 01-04-2025 ([PDF](https://cdn.www.gob.pe/uploads/document/file/8093943/6631517-resolucion-de-alcaldia-n-59-2025-mph-a-anexo.pdf)).

- **Tabla 8 – 7 zonas críticas por lluvias intensas e inundación en la provincia:**

  | Zona crítica | Sectores | Población | Viviendas | Otros expuestos |
  |---|---|---|---|---|
  | Río Seco | Pedregal, Shaurama, Villón Alto, Chunamará, Bellavista | 4660 | 400 | 35 instituciones educativas, 2 comisarías |
  | Canal de Tajamar | Urb. Las Terrazas | 280 | 70 | |
  | Río Santa – tramo Quechcap | Quechcap | 5000 | 200 | |
  | Jauna | Jauna central | 40 | 21 | |
  | Quebradas Lloclla, Puchcoc y Uchuyacu | Distrito de Taricá | | | |

- **Emergencias:**
  - 25 emergencias en el cercado de Huaraz por quebradas activadas, desbordes e inundaciones.
  - Fichas SINPAD de dic-2024 a feb-2025: Chunamará (2), Shaurama (2), Tacllán Alto, Rataquenua y Los Pinos. Casi todas son deslizamientos por lluvias en terrenos con cortes de talud.
- **El documento no trae coordenadas.** En `data/processed/huaraz/municipalidad_lluvias_2025.geojson` cada sector se ubicó de forma aproximada con:
  - Nominatim/OSM;
  - rótulos del mapa oficial de 2025 (Pedregal coincide a ~55 m y Villón Alto a ~100 m entre ambas fuentes);
  - para Shaurama, las coordenadas impresas en la foto de la ficha SINPAD 216675.
- **Sin ubicar:** Chunamará, Urb. Las Terrazas y Quechcap.
- Se muestran como **puntos de sector, no como zonas**.
- **Pendiente:** pedir a la OGRDyDC la delimitación de estas zonas críticas. El plan contrata además estudios de simulación hidráulica de 5 quebradas (Quinchup, Huapish, Cauac Cruz, Coyllur y Río Seco).

**Actualización (19-11-2026): ubicación completa y sombreado**

**Ubicación de los sectores:**
- Con coordenadas oficiales del **INEI** (centros poblados del Censo 2007, capa "Centro Poblado" de `SERV_CARTOGRAFIA_BASE_WGS84` en GEOCATMIN) [V]:
  - CHUNA MARA (0201010017)
  - QUECHCAP (0201010022)
  - SHAURAMA (0201010155)
  - JAUNA CENTRAL (0201010078)
- Pedregal y Villón Alto, con OpenStreetMap.
- Bellavista, con el rótulo del mapa oficial de 2025.
- Canal de Tajamar – Urb. Las Terrazas: Las Terrazas no figura en fuentes abiertas. Se ubicó **de forma tentativa** a lo largo del Jr./Calle/Pasaje Tajamar de OSM, asumiendo que la vía sigue al canal.

**Cómo se dibujan en el visor:**
- Cada sector se sombrea en rojo como un **círculo de 200 m** alrededor de su ubicación.
- El canal se dibuja como una **franja de ±30 m**.
- Son **aproximaciones del sector, no la mancha de inundación**, porque el documento municipal no la trae. Se rotulan así en el mapa, en la leyenda y en la consulta.
- **Pendiente:** reemplazarlas por la delimitación oficial cuando la Municipalidad la entregue.

### 10.12 Inundaciones registradas en el centro de Huaraz (19-11-2026)

- **Contraloría General de la República** [V vía prensa]:
  - Informe de control concurrente (Hito N.° 7) a la obra de la Av. Luzuriaga, difundido por Áncash al Día el 20-05-2025.
  - Dice que el sistema de drenaje pluvial de Huaraz *"no garantiza la evacuación de aguas pluviales, posibilitando que continúen las inundaciones y aniegos en la avenida Luzuriaga"*, en el tramo **Av. Antonio Raymondi – Av. Pedro Villón**.
  - [Nota](https://ancashaldia.com/huaraz-contraloria-alerto-falta-de-acciones-para-reinicio-de-obras-de-avenida-luzuriaga-en/).
  - **Pendiente:** obtener el informe original de la Contraloría.
- **18-12-2023** (Agencia Andina y Radio RSD) [V]: colapsó el alcantarillado y el centro se inundó, con reporte desde la Av. Luzuriaga con Jr. Sucre, junto a la Plaza de Armas.
  - [Andina](https://andina.pe/agencia/noticia-emergencia-huaraz-lluvia-intensa-inunda-calles-del-centro-y-colapsa-alcantarillado-967227.aspx)
  - [RSD](https://radiorsd.pe/noticias/urgente-ancash-torrencial-lluvia-inunda-el-centro-de-huaraz)
- **24-09-2026** (Diario de Chimbote) [V]: aniegos en calles de Huaraz con las primeras lluvias de la temporada; la nota no da calles.
- **Archivo:** `data/processed/huaraz/aniegos_centro.geojson`.
  - Tramo de la Av. Luzuriaga recortado de OSM entre los cruces con Raymondi (-9.52618) y Pedro Villón (-9.53531).
  - Punto del evento de 2023.
  - En el visor la avenida se sombrea como una **franja de ±20 m**: el aniego ocurre sobre la vía y sus veredas.
- **Pendiente:** pedir al INDECI o a la Municipalidad los registros SINPAD con ubicación de las 25 emergencias del cercado (2024-2025).

### 10.13 Inundaciones por lluvia reportadas en noticias (19-11-2026)

- **Resultado:** 18 eventos con lugar preciso en **14 lugares** de Huaraz e Independencia, de 2018 a 2026. Se abrió cada nota y se guardó una cita textual. Datos en `data/raw/huaraz/noticias_inundaciones.json` (detalle) y `data/processed/huaraz/noticias_inundaciones.geojson` (lugares).
- **Medios:** Andina, RSD, Ancash Noticias, Diario de Chimbote, Panamericana, Correo, RPP y Huaraz Noticias.
- **Lugares con inundaciones repetidas:**
  - Av. 27 de Noviembre con Villón (oct-2025 y nov-2026)
  - Primera cuadra de la Av. Raymondi (mar-2026 y nov-2026)
  - Mercado Central (feb-2019 y dic-2023, por colapso del canal Tajamar)
  - Av. Luzuriaga con Jr. Sucre (dic-2021 y dic-2023)
- **Ubicación:**
  - Cruces de calles y edificios calculados con geometría de OSM: "alta".
  - Sectores con OSM o con centros poblados de INEI/MINEDU/IGN: "media".
  - **Cushuruyoc** (dic-2021) no se pudo ubicar.
- **En el visor:**
  - Zona de 60 m si el lugar es preciso y de 150 m si es un sector.
  - El marcador muestra cuántas veces se inundó.
  - Al tocarlo se ven las fechas, el medio, el enlace y la cita.
- **Descartados:**
  - Desborde del río Casca (abr-2025): lo causó un derrumbe sobre una laguna.
  - Marian, Huanchac y Ucrumaran: centros poblados rurales.
  - Mercado Central en dic-2022: el agua entró por obras en el techo.
  - Secsecpampa y Balcón de Judas: fueron colapsos o derrumbes, no inundaciones.
- **Corrección al Canal de Tajamar:** las noticias indican que el canal pasa también por el Mercado Central, así que el trazado tentativo a lo largo del Jr. Tajamar es incompleto.

### 10.14 Modo "Huaico": por dónde se desplazaría un flujo que llegue al centro (19-11-2026)

Se muestran en **azul** dos áreas:

- **Río Quillcay:** el mismo polígono digitalizado del mapa oficial INAIGEM/Municipalidad (mayo 2025), con 4 tonos de azul según el nivel de peligro del modelo.
  - Es el área modelada para un flujo de detritos que baja por el Quillcay en su **escenario máximo** (aluvión de Palcacocha).
  - Se usa como envolvente: un huaico menor cubriría menos superficie, empezando por el núcleo junto al cauce.
  - **No es un modelo propio del proyecto.**
- **Río Seco:** los sectores de la zona crítica municipal (área aproximada de 200 m), en relación con la zona crítica del INGEMMET "Quebrada Río Seco: flujo de detritos e inundación de detritos".
- **Otras quebradas** (Paria, Auqui, Casca): no tienen área dibujada porque no hay un estudio publicado. Solo se muestra su cauce.

### 10.15 Sombreado de los eventos puntuales del INGEMMET (19-11-2026)

- Los 103 eventos del inventario y de "otros peligros" (mayormente de 2007) solo tienen ubicación.
- Por coherencia con la capa de noticias, cada uno se sombrea en rojo claro con un **círculo de 50 m** y borde punteado, rotulado "área aproximada, tamaño real desconocido".
- Las 85 áreas medidas en informes técnicos se siguen dibujando con su forma real, en rojo más intenso y con borde continuo.

### 10.16 Base completa de lugares del distrito de Huaraz (19-11-2026)

**Fuentes:**
- **INEI – GeoServer de interoperabilidad** (`https://geoespacial.inei.gob.pe/geoserver/Interoperabilidad/ows`, WFS público, sin licencia indicada) [V], filtrado por `ubigeo='020101'`. Archivos guardados en `data/raw/inei/`:
  - `ig_manzana`: **1007 manzanas** censales del distrito, en 14 zonas censales; 859 en la ciudad de Huaraz (codccpp 0001). Polígonos con identificador `idmanzana`.
  - `ig_casco_urbano`: polígono del casco urbano de Huaraz.
  - `ig_centropoblado`: 154 centros poblados del distrito.
- **OpenStreetMap:** 280 calles con nombre (458 tramos) y 48 barrios, sectores o caseríos dentro del distrito de Huaraz.
- **GEOCATMIN-INGEMMET** (capa "Centro Poblado"): 246 registros del distrito (INEI 2007, MINEDU/IGN).

**Uso propuesto:** las manzanas del INEI cubren toda la ciudad. Sirven para que **cada cuadra** tenga un estado:
- el peligro que le corresponde según las capas oficiales;
- o **"sin información"**, para que no haya calles vacías.

### 10.17 Mapa por manzanas del distrito de Huaraz (19-11-2026)

- **Script:** `scripts/etl/huaraz_manzanas.py`, solo con la biblioteca estándar (~4 s). **Salida:** `data/processed/huaraz/manzanas_peligro.geojson`.
- **Método:** cada una de las **1007 manzanas del INEI** se evalúa en su centroide y en sus vértices contra todas las capas procesadas, y se le asigna el nivel más alto de cada peligro:
  - `-1` = evaluada sin peligro identificado (aluvión: dentro del área del mapa oficial; deslizamiento: susceptibilidad baja o muy baja);
  - `0` = **sin información**.
- **Resultado (número de manzanas por nivel):**

  | Peligro | -1 (evaluada) | 0 (sin información) | Niveles 1 a 4 |
  |---|---|---|---|
  | Aluvión | 653 | 167 | 29 / 7 / 8 / 143 |
  | Inundación por lluvias | — | 773 | 19 / 173 / 42 / — |
  | Huaico | — | 714 | 29 / 102 / 8 / 154 |
  | Deslizamiento | 664 | 8 | 188 / 146 / — / 1 |
  | Caída de rocas | — | 1005 | — / 2 / — / — |
  | Erosión | — | 993 | — / 13 / — / 1 |

- **En el visor:**
  - Casilla "Colorear cada manzana", activada por defecto.
  - Colores según el peligro elegido; las manzanas sin información van en gris, con el aviso "no significa que sea segura".
  - La consulta empieza indicando la manzana, su nivel y las fuentes que la sustentan.
- **No crea información nueva:** solo reparte por manzana lo que dicen las fuentes.

### 10.18 Reglas de la app (fase 2)

- **Registrado cerca (nivel 1):** si no hay nada en el punto, pero hay un evento, aniego, área evaluada, zona crítica o sector a ≤ 150 m, el veredicto dice "registrado a X m". El aluvión no usa esta regla: su mapa oficial ya delimita las zonas.
- **Zonas críticas del INGEMMET:** son puntos de paraje sin extensión; se les asigna un radio aproximado de 100 m (confianza media) y nivel 2 dentro de ese radio.
- El color de cada elemento en el mapa usa la misma regla que el veredicto (`nivelElemento` en `src/features/riesgo/veredicto.ts`), para que el mapa y la tarjeta no se contradigan.
- **"No construyas aquí":** solo donde el terreno mismo es el problema: a ≤ 50 m del cauce de un río o quebrada (OSM), terreno deslizado o extremadamente propenso a deslizarse, y áreas de caída de rocas o erosión evaluadas por el INGEMMET. En la ciudad consolidada (zonas de aluvión, recorrido de huaicos, calles que se inundan) solo se informa el peligro y qué hacer. No se dan probabilidades numéricas: las fuentes dan niveles, no porcentajes. La faja marginal (Ley 29338) la delimita la ANA por tramo; los 50 m son un criterio de cercanía de la app, no el ancho oficial.

### 10.19 Fase 3: pendiente del terreno y buscador de lugares

- **Pendiente:** modelo de elevación **Copernicus GLO-30** (ESA, 30 m, gratuito; `scripts/etl/pendiente_copernicus.sh`). Se suaviza 3×3, se calcula la pendiente en grados y se clasifica con los rangos que usa el **INGEMMET** en sus informes técnicos: fuerte 15°–25°, muy fuerte o escarpada 25°–45°, muy escarpada > 45°. Esos informes señalan que de 15° hacia arriba se facilitan los movimientos en masa. Uso en la app: ≥ 25° → "No construyas aquí"; 15°–25° → "Solo con estudio técnico". Copernicus es un modelo de **superficie** (incluye edificios); se comprobó que el centro (Plaza de Armas, Mercado Central, cono del Quillcay, Pedregal) no queda marcado y que las 48 manzanas con más de 25° están a más de 1,2 km de la Plaza, en laderas.
- **Buscador:** 154 centros poblados del INEI + 910 nombres de OpenStreetMap (barrios, plazas, mercados, colegios, calles; `scripts/etl/osm_lugares.py`), guardados en la tabla `places`. La búsqueda ignora tildes y mayúsculas y entiende abreviaturas ("Jr." = "Jirón", "Av." = "Avenida", "Urb." = "Urbanización"). No depende de servicios externos en cada búsqueda.
- **"¿Cada cuánto pasa?":** sin porcentajes. Inundación: años con noticias de inundación en los últimos 9 años (hoy 6 de 9). Aluvión: último gran evento en 1941 (al menos 1 800 víctimas); Stuart-Smith et al. (2021, *Nature Geoscience*) atribuyen al calentamiento global el retroceso del glaciar que aumentó el peligro. Los demás peligros: temporada de lluvias y sismos, sin frecuencia por lugar.
- **Lugares seguros por peligro** (todos del mapa oficial de evacuación de mayo 2025; no existen mapas oficiales de zonas seguras ante huaico o inundación en Huaraz):
  - Aluvión: los 36 puntos del mapa y las flechas.
  - Huaico: zonas de seguridad y refugios temporales (19) y las flechas, porque el huaico del Quillcay sigue el recorrido del aluvión. Se excluyen los que caen dentro de una zona de huaico (quedó fuera el área verde de Pedregal, en el sector Río Seco).
  - Inundación: solo los 6 refugios temporales, para quien tenga su vivienda inundada; ninguno está en una zona que se inunda. Las áreas verdes no se proponen porque no sirven ante la lluvia (y tres de ellas quedan en zonas con inundaciones reportadas).

### 10.20 Huaico: solo hechos, sin predicción

Se probó una estimación de "zonas de inicio" (quebrada + pendiente ≥ 25° + susceptibilidad alta). **Se descartó**: los huaicos reales más recientes (Ichoca 25-12-2023, cementerio de Independencia, Llaca–Casca 28-04-2025) quedaron a 3,4–3,6 km de las zonas estimadas, porque OpenStreetMap no tiene las quebradas pequeñas. Por decisión del usuario el huaico ya no predice nada:

- **Rojo – ya bajó un huaico:** áreas evaluadas por el INGEMMET, eventos del inventario y eventos recientes 2022–2026 (sección 10.21), con su radio aproximado o su recorrido.
- ~~Rojo claro – huaico registrado a ≤ 150 m~~: **quitado** (revisión del usuario). Un huaico baja por su cauce, no en círculo; ese círculo marcaba también cuesta arriba o al otro lado de una loma. Lo reemplaza el camino aguas abajo; el registro cercano sigue apareciendo en "Ver por qué".
- **Azul fuerte – zona crítica por huaico del INGEMMET** (p. ej. "Quebrada Río Seco: flujo de detritos e inundación de detritos"), con su radio aproximado de 100 m.
- **Corrección (revisión del usuario):** los 5 sectores de la zona crítica municipal "Río Seco" (Pedregal, Villón Alto, Bellavista, Shaurama, Chunamará) se habían copiado al huaico. Se quitaron: la tabla 8 del plan municipal es de **lluvias intensas e inundación**, no de huaicos, y ninguna fuente traza un recorrido de huaico hasta esos sectores (Villón Alto está a ~370 m del cauce más cercano de OSM y a ~1 km del punto crítico del INGEMMET). Siguen en el modo **inundación**.
- **Azul claro – cerca de un río o quebrada (≤ 50 m):** criterio de la app sobre los cauces de OpenStreetMap, **no es una zona oficial** (el ancho de la faja marginal lo fija la ANA por tramo y no se tiene ese dato). La leyenda del mapa lo dice.
- El nivel de huaico de cada manzana se recalcula en `scripts/db/cargar-huaraz.ts` con esta misma regla.
- Las flechas de evacuación solo se muestran en aluvión.

### 10.21 Eventos recientes 2022–2026 (investigación por peligro)

Cinco investigaciones en paralelo (huaico, deslizamiento, erosión, caída de rocas, inundación; aluvión excluido) en INDECI, INGEMMET, INAIGEM, CENEPRED/SIGRID, municipalidades y prensa regional. Cada evento tiene al menos una fuente abierta con **cita textual**, fecha, ubicación (INEI, OpenStreetMap o Nominatim) y confianza. Archivos: `data/raw/huaraz/eventos_recientes_<peligro>.json` (incluyen la lista de descartados y el motivo).

- Radio aproximado por confianza de ubicación: alta 60 m, media 150 m, baja 300 m.
- **Flujo del 28-04-2025 (Llaca → Casca → Paria → río Santa):** derrumbe sobre una laguna glaciar del Vallunaraju; recorrió más de 12 km y cruzó Independencia por Palmira (inspección técnica INAIGEM–INGEMMET). Se dibuja como franja de 80 m sobre la quebrada Llaca y el río Paria de OSM; el tramo de ~1,1 km del río Casca que OSM no tiene se trazó en línea recta (aproximado).
- Revisiones del proyecto: se quitó de caída de rocas el derrumbe del Vallunaraju (es el origen del flujo, ya registrado); el Centro de Salud de Huarupampa (inundación 06-11-2026) se marcó como ubicación tentativa (local provisional sin dirección publicada).
- En las manzanas, los eventos recientes **suben** el nivel del peligro (nunca lo bajan).
- **"Sin peligros identificados"** ya no se muestra si a ≤ 500 m ocurrió algún evento, ni fuera de las manzanas del INEI (el mapa del aluvión solo cubre el Quillcay y no basta).
- Vacíos: pocas fuentes para 2022–2024; varios resúmenes de INDECI del Congreso no se pudieron abrir. Muchas fechas son de publicación (lo indica cada descripción).

### 10.22 Huaico: toda zona propensa conectada con su camino aguas abajo

Revisión del usuario: un lugar propenso a huaico debe estar unido por un cauce al lugar de donde vendría el flujo; y al tocar un azul oscuro no debe salir "sin información".

- **"Sin información" en azul oscuro:** las capas del mapa se guardaban en el navegador hasta un día (`stale-while-revalidate=86400`) y mostraban zonas ya corregidas. Ahora las rutas de datos usan ETag: el navegador pregunta siempre si cambiaron (304 si no).
- **Caminos aguas abajo** (`scripts/etl/huaico_caminos.ts`, 36 caminos): desde cada huaico ocurrido y cada zona crítica por huaico del INGEMMET se sigue la dirección de mayor pendiente del modelo Copernicus GLO-30 hasta el río Santa. Los ríos y quebradas de OSM se "queman" 30 m en el relieve y las depresiones se rellenan (priority-flood con épsilon). Franja de 50 m, **azul fuerte**.
- Validación: 72–100 % de cada camino coincide con cauces conocidos (Malecón Sur → río Quilcay 1,9 km; Ichoca → quebrada Cojup → Quilcay; Llaca–Casca → río Paria; Purus/Macashca → quebrada Rajucolta). El punto del INGEMMET "Quebrada Río Seco" drena, según el relieve de 30 m, hacia el Quilcay: dato a revisar en campo.
- Error corregido durante el cálculo: el borde real de los datos (esquinas vacías tras reproyectar) no se tomaba como salida del agua y el valle se "rellenaba" hasta 3 437 m; los caminos salían rectos. Corregido y validado.
- No es una predicción de dónde nacen huaicos: solo conecta la evidencia (huaicos ocurridos y zonas críticas oficiales) con el cauce por donde bajaría el lodo.

### 10.23 Huaico: rojo solo donde pasó; sin "cerca de un río"

Revisión del usuario:
- **Rojo solo en el mismo lugar donde pasó:** áreas medidas por el INGEMMET, el recorrido documentado del flujo de 2025 (franja de 50 m sobre el cauce) y los eventos con ubicación precisa (radio 60 m). Los eventos ubicados solo por barrio o caserío (confianza media o baja) se muestran como un punto, sin área ni manzanas rojas; siguen en "Ver por qué" y tienen su camino aguas abajo.
- **Se quitó el azul claro** ("a ≤ 50 m de un río o quebrada"): no era una zona oficial y los cauces por donde bajaría un huaico documentado ya están en azul oscuro. La distancia al río se usa solo en **"¿Puedo construir aquí?"**: a ≤ 50 m del cauce → "No construyas aquí" por la faja marginal (Ley 29338).
- Manzanas de huaico en la ciudad: 38 en rojo, 182 en azul oscuro, 787 sin información.

### 10.24 Revisión general: una sola regla para mapa y tarjeta, sin repetidos

- **Una sola regla de niveles.** Antes el color de las manzanas salía de tres reglas distintas (el ETL de Python `huaraz_manzanas.py`, SQL en el cargador para el huaico y la regla de la tarjeta), y en ~10 % de las manzanas el mapa mostraba menos peligro que la tarjeta. Ahora el cargador calcula cada manzana con `nivelElemento` (la misma función de la tarjeta) y la misma regla de "registrado cerca" y de cobertura del aluvión. Verificado: 349 manzanas de los 6 peligros, **0 diferencias** entre mapa y tarjeta. `huaraz_manzanas.py` se sigue usando solo para la geometría de las manzanas; sus columnas `n_*` y `d_*` ya no se usan.
- **Repetidos quitados:** si un evento del inventario coincide (mismo peligro, ≤ 50 m) con un evento reciente investigado, queda solo el reciente (fecha real y fuentes con cita): huaico del cementerio de Independencia, huaico de Ichoca (el inventario traía la fecha de registro 28-03-2025; el huaico fue el 25-12-2023), deslizamiento de El Pinar (fechas 2025/2026 en conflicto; queda la del informe A7739) y uno más. Pongor (24-10-2026) quedó solo como deslizamiento.
- **Caminos aguas abajo sin tramos repetidos:** cada camino se dibuja solo hasta donde se une con otro ya dibujado; los 39 orígenes (huaicos y zonas críticas) siguen conectados.
- **Corrección:** la regla de repetidos borró por error el punto de noticias "Av. Luzuriaga con Jr. Sucre" (inundaciones 2021 y 2023), a 29 m de otro evento de 2025. Ahora solo se aplica al inventario del INGEMMET; las noticias nunca se borran.
- **"¿Cada cuánto pasa?"** se calcula de los datos (años con eventos desde 2018): inundación 6 de 9 años; deslizamiento y erosión todos los años desde 2022; huaico 3 de 4; caída de rocas 4 de 6. Aluvión: 1941 (Quillcay) y lagunas pequeñas de la quebrada Llaca en 2025.
