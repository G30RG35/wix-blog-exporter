// Verificar si el script ya se cargó
if (!window.wixBlogExporterLoaded) {
  window.wixBlogExporterLoaded = true;

  // Detectar contexto (dashboard o vista pública)
  const isDashboard =
    window.location.href.includes("/dashboard/") ||
    window.location.href.includes("/editor/");

  // Función mejorada para extraer fechas de los posts
  const extractAvailableMonths = () => {
    const monthSet = new Set();

    try {
      // Selectores para diferentes versiones de Wix
      const dateSelectors = [
        "time[datetime]", // Prioridad a elementos time con datetime
        '[data-testid="post-date"]', // Nueva versión
        '[data-hook="post-date"]', // Versión anterior
        ".post-date", // Clase común
        ".blog-post-date", // Otra clase común
        ".date-published", // Dashboard
        '[aria-label*="fecha"], [aria-label*="date"]', // Elementos ARIA
      ];

      // Buscar fechas en toda la página
      dateSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
          try {
            const dateValue =
              element.getAttribute("datetime") || element.textContent.trim();
            if (dateValue) {
              const dateObj = new Date(dateValue);
              if (!isNaN(dateObj)) {
                const monthId = `${dateObj.getFullYear()}-${String(
                  dateObj.getMonth() + 1
                ).padStart(2, "0")}`;
                monthSet.add(monthId);
              }
            }
          } catch (error) {}
        });
      });

      // Si no encontramos fechas, intentar método alternativo para dashboard
      if (monthSet.size === 0 && isDashboard) {
        document
          .querySelectorAll(
            '[data-testid="post-item"], [data-hook="post-item"]'
          )
          .forEach((post) => {
            const dateElement = post.querySelector(
              '.date, [aria-label*="date"], [title*="date"]'
            );
            if (dateElement) {
              const dateText =
                dateElement.textContent ||
                dateElement.getAttribute("aria-label") ||
                dateElement.getAttribute("title");
              try {
                const dateObj = new Date(dateText);
                if (!isNaN(dateObj)) {
                  const monthId = `${dateObj.getFullYear()}-${String(
                    dateObj.getMonth() + 1
                  ).padStart(2, "0")}`;
                  monthSet.add(monthId);
                }
              } catch (error) {
                console.warn(
                  "[CONTENT SCRIPT] Error procesando fecha alternativa:",
                  error
                );
              }
            }
          });
      }

      // Convertir a array ordenado
      const months = Array.from(monthSet)
        .sort((a, b) => b.localeCompare(a)) // Orden descendente
        .map((monthId) => {
          const [year, month] = monthId.split("-");
          const monthNames = [
            "Enero",
            "Febrero",
            "Marzo",
            "Abril",
            "Mayo",
            "Junio",
            "Julio",
            "Agosto",
            "Septiembre",
            "Octubre",
            "Noviembre",
            "Diciembre",
          ];
          return {
            id: monthId,
            name: `${monthNames[parseInt(month) - 1]} ${year}`,
          };
        });

      return months;
    } catch (error) {
      console.error("[CONTENT SCRIPT] Error crítico al extraer meses:", error);
      return [];
    }
  };

  function getDateInRow(row) {
    const dateSelectors = [
      "td:nth-child(5)", // Quinto TD
      "td:nth-child(5) button span", // Span dentro del botón
      "td:nth-child(5) .wds_1_198_3_ButtonCore__content", // Clase específica del contenido
      "time[datetime]",
      '[data-testid="post-date"]',
      "td:nth-child(5)", // Quinta columna como respaldo
      ".date",
    ];

    for (const selector of dateSelectors) {
      const dateElement = row.querySelector(selector);
      if (dateElement && dateElement.textContent.trim()) {
        let dateText = dateElement.textContent.trim();
        // Limpiar GMT y coma final
        dateText = dateText.replace(/GMT[+-]\d+/, "").trim().replace(/,$/, "");

        // Si es formato "hace X días"
        const matchDias = dateText.match(/hace (\d+) días?/i);
        if (matchDias) {
          const dias = parseInt(matchDias[1], 10);
          const fecha = new Date();
          fecha.setDate(fecha.getDate() - dias);
          return fecha.toISOString().split("T")[0];
        }

        // Si es formato "hace X horas"
        const matchHoras = dateText.match(/hace (\d+) horas?/i);
        if (matchHoras) {
          const horas = parseInt(matchHoras[1], 10);
          const fecha = new Date();
          fecha.setHours(fecha.getHours() - horas);
          return fecha.toISOString().split("T")[0];
        }

        // Si es formato "17 jul"
        const matchFecha = dateText.match(/^(\d{1,2})\s+([a-zA-Záéíóú]+)$/i);
        if (matchFecha) {
          const dia = parseInt(matchFecha[1], 10);
          const mesTexto = matchFecha[2].toLowerCase();
          const meses = {
            ene: 0, enero: 0,
            feb: 1, febrero: 1,
            mar: 2, marzo: 2,
            abr: 3, abril: 3,
            may: 4, mayo: 4,
            jun: 5, junio: 5,
            jul: 6, julio: 6,
            ago: 7, agosto: 7,
            sep: 8, septiembre: 8,
            oct: 9, octubre: 9,
            nov: 10, noviembre: 10,
            dic: 11, diciembre: 11
          };
          const mes = meses[mesTexto] ?? null;
          if (mes !== null) {
            const hoy = new Date();
            const year = hoy.getFullYear();
            const fecha = new Date(year, mes, dia);
            // Si la fecha es en el futuro, usar año anterior
            if (fecha > hoy) fecha.setFullYear(year - 1);
            return fecha.toISOString().split("T")[0];
          }
        }

        // Si es formato "24 jun, 2025"
        const matchFechaCompleta = dateText.match(/^(\d{1,2})\s+([a-zA-Záéíóú]+),?\s*(\d{4})?$/i);
        if (matchFechaCompleta) {
          const dia = parseInt(matchFechaCompleta[1], 10);
          const mesTexto = matchFechaCompleta[2].toLowerCase();
          const year = matchFechaCompleta[3] ? parseInt(matchFechaCompleta[3], 10) : (new Date()).getFullYear();
          const meses = {
            ene: 0, enero: 0,
            feb: 1, febrero: 1,
            mar: 2, marzo: 2,
            abr: 3, abril: 3,
            may: 4, mayo: 4,
            jun: 5, junio: 5,
            jul: 6, julio: 6,
            ago: 7, agosto: 7,
            sep: 8, septiembre: 8,
            oct: 9, octubre: 9,
            nov: 10, noviembre: 10,
            dic: 11, diciembre: 11
          };
          const mes = meses[mesTexto] ?? null;
          if (mes !== null) {
            const fecha = new Date(year, mes, dia);
            return fecha.toISOString().split("T")[0];
          }
        }

        // Intentar parsear directamente
        const parsedDate = new Date(dateText);
        if (!isNaN(parsedDate)) {
          return parsedDate.toISOString().split("T")[0];
        }

        return dateText;
      }
      if (dateElement && dateElement.getAttribute("datetime")) {
        const dateValue = dateElement.getAttribute("datetime");
        const parsedDate = new Date(dateValue);
        if (!isNaN(parsedDate)) {
          return parsedDate.toISOString().split("T")[0]; // Formato YYYY-MM-DD
        }
      }
    }
    return "";
  }

  // Función mejorada para extraer posts de un mes específico
  const extractPostsFromMonth = (monthId) => {
    const posts = [];

    try {
      const [year, month] = monthId.split("-");
      const targetYear = parseInt(year);
      const targetMonth = parseInt(month);

      if (isDashboard && window.location.href.includes("/blog/")) {
        // MÉTODO ESPECÍFICO PARA DASHBOARD DE WIX

        // PRIORIDAD 1: Buscar en tbody con data-index (estructura específica identificada)
        const tbodyRows = document.querySelectorAll(
          "tbody tr[data-index], tbody [data-index]"
        );

        if (tbodyRows.length > 0) {
          tbodyRows.forEach((row, index) => {
            try {
              // Buscar título en diferentes posibles ubicaciones dentro de la fila
              const titleSelectors = [
                "td:first-child", // Primera columna
                "td:nth-child(1)", // Primera columna específica
                "td:first-child a", // Enlaces en primera columna
                "td:first-child span", // Spans en primera columna
                "td:first-child div", // Divs en primera columna
                '[data-testid="post-title"]',
                '[data-hook="post-title"]',
                ".title",
                "h1, h2, h3, h4, h5, h6",
                "span", // Los títulos podrían estar en spans
                "div", // O en divs
              ];

              let titleElement = null;
              let titleText = "";

              for (const titleSelector of titleSelectors) {
                const elements = row.querySelectorAll(titleSelector);
                for (const element of elements) {
                  const text = element.textContent.trim();
                  // Buscar texto que parezca un título de post (más de 5 caracteres, no texto de UI)
                  if (
                    text.length > 5 &&
                    !text.includes("Entradas") &&
                    !text.includes("Filtra") &&
                    !text.includes("Personaliza") &&
                    !text.includes("columnas") &&
                    !text.includes("Estado") &&
                    !text.includes("Fecha") &&
                    !text.includes("Autor") &&
                    !text.includes("Comentarios") &&
                    !text.includes("Vistas")
                  ) {
                    titleElement = element;
                    titleText = text;
                    break;
                  }
                }
                if (titleText) break;
              }

              if (!titleText) {
                return;
              }

              // Buscar fecha en la fila - MEJORADO para el tercer TD
              const dateSelectors = [
                "td:nth-child(3)", // Tercer TD específicamente
                "td:nth-child(3) button span", // El span dentro del botón
                "td:nth-child(3) .wds_1_198_3_ButtonCore__content", // Clase específica del contenido
                "time[datetime]",
                '[data-testid="post-date"]',
                "td:nth-child(4)", // Cuarta columna como respaldo
                ".date",
              ];

              let postDate = new Date();
              let dateText = "";

              for (const dateSelector of dateSelectors) {
                const dateElement = row.querySelector(dateSelector);
                if (dateElement && dateElement.textContent.trim()) {
                  dateText = dateElement.textContent.trim();

                  // Parsear fecha en formato "24 jun, GMT-6" o similar
                  try {
                    // Limpiar el texto de fecha
                    let cleanDateText = dateText
                      .replace(/GMT[+-]\d+/, "")
                      .trim();
                    cleanDateText = cleanDateText.replace(/,$/, ""); // Quitar coma final

                    // Intentar parsear directamente
                    let parsedDate = new Date(cleanDateText);

                    // Si no funciona, intentar convertir mes en español
                    if (isNaN(parsedDate)) {
                      const monthMap = {
                        ene: "Jan",
                        feb: "Feb",
                        mar: "Mar",
                        abr: "Apr",
                        may: "May",
                        jun: "Jun",
                        jul: "Jul",
                        ago: "Aug",
                        sep: "Sep",
                        oct: "Oct",
                        nov: "Nov",
                        dic: "Dec",
                      };

                      let englishDate = cleanDateText;
                      for (const [spanish, english] of Object.entries(
                        monthMap
                      )) {
                        englishDate = englishDate.replace(spanish, english);
                      }

                      parsedDate = new Date(englishDate);
                    }

                    if (!isNaN(parsedDate) && parsedDate.getFullYear() > 2000) {
                      postDate = parsedDate;
                      break;
                    }
                  } catch (parseError) {
                    console.warn(
                      `[CONTENT SCRIPT] Error parseando fecha "${dateText}":`,
                      parseError
                    );
                  }
                }
              }

              // Buscar URL del post
              const linkElement = row.querySelector(
                'td:first-child a[href], a[href*="/post/"], a[href*="/blog/"], a[href]'
              );

              // Buscar imagen en la fila
              let imageUrl = "";
              const imageElement = row.querySelector('img[src]');
              if (imageElement && imageElement.src) {
                let originalSrc = imageElement.src;
                
                // Si es una imagen de Wix (wixstatic.com), convertir a versión completa
                if (originalSrc.includes('wixstatic.com')) {
                  try {
                    // Método 1: Extraer la URL base y crear versión sin redimensionar
                    const baseUrlMatch = originalSrc.match(/(https:\/\/static\.wixstatic\.com\/media\/[^\/]+\.[^\/]+)/);
                    if (baseUrlMatch) {
                      const baseUrl = baseUrlMatch[1];
                      
                      // Opción 1: URL sin redimensionar (preferida)
                      imageUrl = baseUrl;
                      
                      // Opción 2: Si necesitas dimensiones específicas, descomenta la siguiente línea:
                      // imageUrl = `${baseUrl}/v1/fill/w_1938,h_1454,al_c,q_90/${baseUrl.split('/').pop()}`;
                      
                      console.log(`[CONTENT SCRIPT] Imagen extraída: ${imageUrl}`);
                    } else {
                      // Método 2: Intentar extraer de la URL completa
                      const urlParts = originalSrc.split('/v1/fill/');
                      if (urlParts.length >= 2) {
                        imageUrl = urlParts[0]; // Parte antes de /v1/fill/
                        console.log(`[CONTENT SCRIPT] Imagen base extraída: ${imageUrl}`);
                      } else {
                        imageUrl = originalSrc; // Usar original si no podemos procesar
                      }
                    }
                  } catch (error) {
                    console.warn('[CONTENT SCRIPT] Error procesando URL de imagen:', error);
                    imageUrl = originalSrc;
                  }
                } else {
                  imageUrl = originalSrc;
                }
              }

              // Buscar contenido/descripción
              const contentSelectors = [
                "td:nth-child(2)", // Segunda columna podría ser descripción
                "td:nth-child(4)", // Cuarta columna podría ser descripción
                "td:nth-child(5)", // Quinta columna podría ser descripción
                ".description",
                ".excerpt",
              ];

              let contentText = "";
              for (const contentSelector of contentSelectors) {
                const contentElement = row.querySelector(contentSelector);
                if (
                  contentElement &&
                  contentElement.textContent.trim().length > titleText.length
                ) {
                  contentText = contentElement.textContent
                    .trim()
                    .substring(0, 500);
                  break;
                }
              }

              console.log(
                "[CONTENT SCRIPT] Información de debug recibida:",
                row
              );

              const post = {
                titulo: titleText,
                fecha: getDateInRow(row),
                url: linkElement ? linkElement.href : "",
                imagen: imageUrl,
                content: contentText,
                dataIndex: row.getAttribute("data-index"),
              };

              posts.push(post);
            } catch (error) {
              console.warn(
                `[CONTENT SCRIPT] Error procesando fila ${index}:`,
                error
              );
            }
          });
        }

        // PRIORIDAD 2: Si no encontramos en tbody, buscar otras estructuras de dashboard
        if (posts.length === 0) {
          const dashboardPostSelectors = [
            '[data-testid="blog-post-item"]',
            '[data-hook="blog-post-item"]',
            ".blog-post-item",
            '[data-testid="post-item"]',
            '[data-hook="post-item"]',
            ".post-item",
            "tr[data-testid], tr[data-hook]", // Filas con atributos data pero sin data-index
            '[role="row"]',
          ];

          dashboardPostSelectors.forEach((selector) => {
            const elements = document.querySelectorAll(selector);

            elements.forEach((element, index) => {
              try {
                const titleElement = element.querySelector(
                  'h1, h2, h3, h4, td:first-child, .title, a[href*="/post/"]'
                );

                if (
                  titleElement &&
                  titleElement.textContent.trim().length > 5
                ) {
                  const titleText = titleElement.textContent.trim();

                  // Filtrar elementos de UI
                  if (
                    titleText.includes("Entradas") ||
                    titleText.includes("Filtra") ||
                    titleText.includes("Personaliza") ||
                    titleText.includes("columnas")
                  ) {
                    return;
                  }

                  const post = {
                    title: titleText,
                    content: "",
                    date: new Date().toISOString(),
                    url: "",
                    image: "",
                    monthId: monthId,
                    extractMethod: "dashboard-alternative",
                    index: index,
                    selector: selector,
                  };

                  if (!posts.find((p) => p.title === post.title)) {
                    posts.push(post);
                  }
                }
              } catch (error) {
                console.warn(
                  "[CONTENT SCRIPT] Error en dashboard alternativo:",
                  error
                );
              }
            });
          });
        }
      } else {
        // MÉTODO PARA VISTA PÚBLICA

        const publicPostSelectors = [
          "article",
          ".blog-post",
          ".post-item",
          '[data-testid="post-item"]',
          '[data-hook="post-item"]',
          ".blog-post-preview",
        ];

        publicPostSelectors.forEach((selector) => {
          const elements = document.querySelectorAll(selector);

          elements.forEach((element, index) => {
            try {
              const titleElement = element.querySelector(
                'h1, h2, h3, h4, .title, .post-title, [data-testid="post-title"]'
              );
              const dateElement = element.querySelector(
                'time[datetime], [data-testid="post-date"], [data-hook="post-date"], .post-date'
              );
              const linkElement =
                element.querySelector("a[href]") || element.closest("a[href]");
              const contentElement = element.querySelector(
                ".post-content, .post-excerpt, p"
              );
              const imageElement = element.querySelector("img");

              if (titleElement && titleElement.textContent.trim()) {
                let postDate = new Date();
                if (dateElement) {
                  const dateValue =
                    dateElement.getAttribute("datetime") ||
                    dateElement.textContent.trim();
                  const parsedDate = new Date(dateValue);
                  if (!isNaN(parsedDate)) {
                    postDate = parsedDate;
                  }
                }

                const post = {
                  title: titleElement.textContent.trim(),
                  content: contentElement
                    ? contentElement.textContent.trim().substring(0, 500)
                    : "",
                  date: postDate.toISOString(),
                  url: linkElement ? linkElement.href : "",
                  image: imageElement ? imageElement.src : "",
                  monthId: monthId,
                  extractMethod: "public",
                  index: index,
                  selector: selector,
                };

                if (!posts.find((p) => p.title === post.title)) {
                  posts.push(post);
                }
              }
            } catch (error) {
              console.warn(
                "[CONTENT SCRIPT] Error procesando elemento público:",
                error
              );
            }
          });
        });
      }

      // MÉTODO DE RESPALDO: Buscar por texto visible que parezca títulos de blog
      if (posts.length === 0) {
        const allHeadings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
        allHeadings.forEach((heading, index) => {
          const text = heading.textContent.trim();

          // Filtrar títulos que no sean del menú
          if (
            (text.length > 5 && !text.includes("Blog")) ||
            !text.includes("Resumen") ||
            !text.includes("Entradas") ||
            !text.includes("Comentarios") ||
            !text.includes("Categorías")
          ) {
            const post = {
              title: text,
              content: "",
              date: new Date().toISOString(),
              url: "",
              image: "",
              monthId: monthId,
              extractMethod: "headings",
              index: index,
            };

            posts.push(post);
          }
        });
      }

      // Log final y agrupar por fecha
      if (posts.length > 0) {
        console.log(`[CONTENT SCRIPT] Posts extraídos: ${posts.length}`);
        
        // Agrupar posts por fecha
        const groupedByDate = {};
        let imageCounter = 1; 
        
        posts.forEach(post => {
          const fecha = post.fecha;
          if (!groupedByDate[fecha]) {
            groupedByDate[fecha] = [];
          }
          
          // Determinar nombre incremental y URL de imagen
          let imagenNombre = "";
          let imagenUrl = "";
          if (post.imagen && post.imagen.trim()) {
            imagenNombre = `${imageCounter}.webp`;
            imagenUrl = post.imagen; // URL real de la imagen
            imageCounter++;
          }
          
          groupedByDate[fecha].push({
            texto: post.titulo,
            imagen: imagenNombre,
            url: imagenUrl
          });
        });
        
        // Convertir a la estructura deseada
        const entradas = Object.keys(groupedByDate)
          .sort() // Ordenar fechas
          .map(fecha => ({
            fecha: fecha,
            notas: groupedByDate[fecha]
          }));
        
        return { entradas };
      } else {
        console.log("- URL actual:", window.location.href);
        console.log("- Es dashboard:", isDashboard);
        console.log(
          "- Total de filas de tabla:",
          document.querySelectorAll('tr, [role="row"]').length
        );
        console.log(
          '- Total de elementos con "post":',
          document.querySelectorAll(
            '[class*="post"], [data-testid*="post"], [data-hook*="post"]'
          ).length
        );
        console.log(
          "- Total de headings:",
          document.querySelectorAll("h1, h2, h3, h4, h5, h6").length
        );
        
        return { entradas: [] };
      }

      return { entradas: [] };
    } catch (error) {
      console.error(
        `[CONTENT SCRIPT] Error crítico extrayendo posts de ${monthId}:`,
        error
      );
      return [];
    }
  };

  // Manejar mensajes
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getAvailableMonths") {
      try {
        const months = extractAvailableMonths();

        // Si no hay meses, devolver los últimos 3 meses como respaldo
        if (months.length === 0) {
          const currentDate = new Date();
          const defaultMonths = [
            {
              id: `${currentDate.getFullYear()}-${String(
                currentDate.getMonth() + 1
              ).padStart(2, "0")}`,
              name: "Mes actual",
            },
            {
              id: `${currentDate.getFullYear()}-${String(
                currentDate.getMonth()
              ).padStart(2, "0")}`,
              name: "Mes anterior",
            },
            {
              id: `${currentDate.getFullYear()}-${String(
                currentDate.getMonth() - 1
              ).padStart(2, "0")}`,
              name: "Hace dos meses",
            },
          ].filter((m) => !m.id.includes("NaN"));

          sendResponse({
            success: true,
            months: defaultMonths,
            isDefault: true,
          });
        } else {
          sendResponse({ success: true, months });
        }
      } catch (error) {
        console.error(
          "[CONTENT SCRIPT] Error al procesar getAvailableMonths:",
          error
        );
        sendResponse({ success: false, error: error.message });
      }
      return true; // Respuesta asíncrona
    }

    if (request.action === "exportPosts") {
      try {
        const result = extractPostsFromMonth(request.monthId);
        sendResponse({ success: true, data: result });
      } catch (error) {
        console.error("[CONTENT SCRIPT] Error al exportar posts:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // Respuesta asíncrona
    }

    // NUEVA ACCIÓN: Exportar por rango de fechas
    if (request.action === "exportPostsByDateRange") {
      try {
        const startDate = new Date(request.startDate);
        const endDate = new Date(request.endDate);
        
        console.log(`[CONTENT SCRIPT] Exportando posts desde ${request.startDate} hasta ${request.endDate}`);
        
        const allPosts = [];
        
        // Obtener todos los posts disponibles
        const tbodyRows = document.querySelectorAll("tbody tr[data-index], tbody [data-index]");
        
        tbodyRows.forEach((row, index) => {
          try {
            // Extraer información básica del post
            const titleSelectors = [
              "td:first-child", "td:nth-child(1)", "td:first-child a", 
              "td:first-child span", "td:first-child div", 
              '[data-testid="post-title"]', '[data-hook="post-title"]', 
              ".title", "h1, h2, h3, h4, h5, h6", "span", "div"
            ];

            let titleElement = null;
            let titleText = "";

            for (const titleSelector of titleSelectors) {
              const elements = row.querySelectorAll(titleSelector);
              for (const element of elements) {
                const text = element.textContent.trim();
                if (text.length > 5 && !text.includes("Entradas") && !text.includes("Filtra") && 
                    !text.includes("Personaliza") && !text.includes("columnas") && 
                    !text.includes("Estado") && !text.includes("Fecha") && 
                    !text.includes("Autor") && !text.includes("Comentarios") && 
                    !text.includes("Vistas")) {
                  titleElement = element;
                  titleText = text;
                  break;
                }
              }
              if (titleText) break;
            }

            if (!titleText) return;

            // Extraer fecha
            const postDateStr = getDateInRow(row);
            if (!postDateStr) return;
            
            const postDate = new Date(postDateStr);
            
            // Verificar si está en el rango
            if (postDate >= startDate && postDate <= endDate) {
              // Extraer información adicional
              const linkElement = row.querySelector('td:first-child a[href], a[href*="/post/"], a[href*="/blog/"], a[href]');
              
              let imageUrl = "";
              const imageElement = row.querySelector('img[src]');
              if (imageElement && imageElement.src) {
                let originalSrc = imageElement.src;
                if (originalSrc.includes('wixstatic.com')) {
                  try {
                    const baseUrlMatch = originalSrc.match(/(https:\/\/static\.wixstatic\.com\/media\/[^\/]+\.[^\/]+)/);
                    if (baseUrlMatch) {
                      imageUrl = baseUrlMatch[1];
                    } else {
                      const urlParts = originalSrc.split('/v1/fill/');
                      if (urlParts.length >= 2) {
                        imageUrl = urlParts[0];
                      } else {
                        imageUrl = originalSrc;
                      }
                    }
                  } catch (error) {
                    imageUrl = originalSrc;
                  }
                } else {
                  imageUrl = originalSrc;
                }
              }

              const post = {
                titulo: titleText,
                fecha: postDateStr,
                url: linkElement ? linkElement.href : "",
                imagen: imageUrl,
                content: "",
                dataIndex: row.getAttribute("data-index"),
              };

              allPosts.push(post);
            }
          } catch (error) {
            console.warn(`[CONTENT SCRIPT] Error procesando fila ${index}:`, error);
          }
        });

        // Agrupar por fecha
        const groupedByDate = {};
        let imageCounter = 1; // Contador global para nombres de imágenes
        
        allPosts.forEach(post => {
          const fecha = post.fecha;
          if (!groupedByDate[fecha]) {
            groupedByDate[fecha] = [];
          }
          
          // Determinar nombre incremental y URL de imagen
          let imagenNombre = "";
          let imagenUrl = "";
          if (post.imagen && post.imagen.trim()) {
            imagenNombre = `${imageCounter}.webp`;
            imagenUrl = post.imagen; // URL real de la imagen
            imageCounter++;
          }
          
          groupedByDate[fecha].push({
            texto: post.titulo,
            imagen: imagenNombre,
            url: imagenUrl
          });
        });
        
        const entradas = Object.keys(groupedByDate)
          .sort()
          .map(fecha => ({
            fecha: fecha,
            notas: groupedByDate[fecha]
          }));
        
        console.log(`[CONTENT SCRIPT] Posts en rango encontrados: ${allPosts.length}`);
        sendResponse({ success: true, data: { entradas } });
      } catch (error) {
        console.error("[CONTENT SCRIPT] Error al exportar posts por rango:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    // NUEVA ACCIÓN: Exportar todos los posts
    if (request.action === "exportAllPosts") {
      try {
        console.log("[CONTENT SCRIPT] Exportando todos los posts disponibles");
        
        const allPosts = [];
        const tbodyRows = document.querySelectorAll("tbody tr[data-index], tbody [data-index]");
        
        tbodyRows.forEach((row, index) => {
          try {
            // Usar la misma lógica de extracción que en extractPostsFromMonth
            const titleSelectors = [
              "td:first-child", "td:nth-child(1)", "td:first-child a", 
              "td:first-child span", "td:first-child div", 
              '[data-testid="post-title"]', '[data-hook="post-title"]', 
              ".title", "h1, h2, h3, h4, h5, h6", "span", "div"
            ];

            let titleElement = null;
            let titleText = "";

            for (const titleSelector of titleSelectors) {
              const elements = row.querySelectorAll(titleSelector);
              for (const element of elements) {
                const text = element.textContent.trim();
                if (text.length > 5 && !text.includes("Entradas") && !text.includes("Filtra") && 
                    !text.includes("Personaliza") && !text.includes("columnas") && 
                    !text.includes("Estado") && !text.includes("Fecha") && 
                    !text.includes("Autor") && !text.includes("Comentarios") && 
                    !text.includes("Vistas")) {
                  titleElement = element;
                  titleText = text;
                  break;
                }
              }
              if (titleText) break;
            }

            if (!titleText) return;

            // Extraer fecha
            const postDateStr = getDateInRow(row);
            
            // Extraer información adicional
            const linkElement = row.querySelector('td:first-child a[href], a[href*="/post/"], a[href*="/blog/"], a[href]');
            
            let imageUrl = "";
            const imageElement = row.querySelector('img[src]');
            if (imageElement && imageElement.src) {
              let originalSrc = imageElement.src;
              if (originalSrc.includes('wixstatic.com')) {
                try {
                  const baseUrlMatch = originalSrc.match(/(https:\/\/static\.wixstatic\.com\/media\/[^\/]+\.[^\/]+)/);
                  if (baseUrlMatch) {
                    imageUrl = baseUrlMatch[1];
                  } else {
                    const urlParts = originalSrc.split('/v1/fill/');
                    if (urlParts.length >= 2) {
                      imageUrl = urlParts[0];
                    } else {
                      imageUrl = originalSrc;
                    }
                  }
                } catch (error) {
                  imageUrl = originalSrc;
                }
              } else {
                imageUrl = originalSrc;
              }
            }

            const post = {
              titulo: titleText,
              fecha: postDateStr || new Date().toISOString().split('T')[0],
              url: linkElement ? linkElement.href : "",
              imagen: imageUrl,
              content: "",
              dataIndex: row.getAttribute("data-index"),
            };

            allPosts.push(post);
          } catch (error) {
            console.warn(`[CONTENT SCRIPT] Error procesando fila ${index}:`, error);
          }
        });

        // Agrupar por fecha
        const groupedByDate = {};
        let imageCounter = 1; // Contador global para nombres de imágenes
        
        allPosts.forEach(post => {
          const fecha = post.fecha;
          if (!groupedByDate[fecha]) {
            groupedByDate[fecha] = [];
          }
          
          // Determinar nombre incremental y URL de imagen
          let imagenNombre = "";
          let imagenUrl = "";
          if (post.imagen && post.imagen.trim()) {
            imagenNombre = `${imageCounter}.webp`;
            imagenUrl = post.imagen; // URL real de la imagen
            imageCounter++;
          }
          
          groupedByDate[fecha].push({
            texto: post.titulo,
            imagen: imagenNombre,
            url: imagenUrl
          });
        });
        
        const entradas = Object.keys(groupedByDate)
          .sort()
          .map(fecha => ({
            fecha: fecha,
            notas: groupedByDate[fecha]
          }));
        
        console.log(`[CONTENT SCRIPT] Total de posts encontrados: ${allPosts.length}`);
        sendResponse({ success: true, data: { entradas } });
      } catch (error) {
        console.error("[CONTENT SCRIPT] Error al exportar todos los posts:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    if (request.action === "debugInfo") {
      try {
        const tbodyDataIndex = document.querySelectorAll(
          "tbody tr[data-index], tbody [data-index]"
        );
        const info = {
          url: window.location.href,
          articles: document.querySelectorAll("article").length,
          posts: document.querySelectorAll(
            '[class*="post"], [data-testid*="post"], [data-hook*="post"]'
          ).length,
          blogLinks: document.querySelectorAll(
            'a[href*="/post/"], a[href*="/blog/"], a[href*="blog"]'
          ).length,
          dates: document.querySelectorAll(
            'time[datetime], [data-testid="post-date"], [data-hook="post-date"], .post-date, .blog-post-date'
          ).length,
          titles: document.querySelectorAll(
            'h1, h2, h3, h4, .title, .post-title, [data-testid="post-title"]'
          ).length,
          isDashboard:
            window.location.href.includes("/dashboard/") ||
            window.location.href.includes("/editor/"),
          domain: window.location.hostname,
          // Información específica del dashboard
          tableRows: document.querySelectorAll('tbody tr, [role="row"]').length,
          blogPostItems: document.querySelectorAll(
            '[data-testid="blog-post-item"], [data-hook="blog-post-item"]'
          ).length,
          isInBlogSection: window.location.href.includes("/blog/"),
          allHeadings: document.querySelectorAll("h1, h2, h3, h4, h5, h6")
            .length,
          // Nueva información específica sobre data-index
          tbodyDataIndexRows: tbodyDataIndex.length,
          dataIndexSample: Array.from(tbodyDataIndex.slice(0, 3)).map(
            (row, i) => ({
              index: i,
              dataIndex: row.getAttribute("data-index"),
              firstCellText:
                row
                  .querySelector("td:first-child")
                  ?.textContent.trim()
                  .substring(0, 50) || "N/A",
              allCellsCount: row.querySelectorAll("td").length,
            })
          ),
        };

        sendResponse({ success: true, info });
      } catch (error) {
        console.error("[CONTENT SCRIPT] Error obteniendo debug info:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // Respuesta asíncrona
    }
  });
}
