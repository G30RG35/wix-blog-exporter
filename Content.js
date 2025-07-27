// Verificar si el script ya se cargó
if (!window.wixBlogExporterLoaded) {
  window.wixBlogExporterLoaded = true;
  console.log('[CONTENT SCRIPT] Iniciando en:', window.location.href);

  // Detectar contexto (dashboard o vista pública)
  const isDashboard = window.location.href.includes('/dashboard/') || 
                     window.location.href.includes('/editor/');

  // Función mejorada para extraer fechas de los posts
  const extractAvailableMonths = () => {
    console.log('[CONTENT SCRIPT] Extrayendo meses disponibles...');
    const monthSet = new Set();

    try {
      // Selectores para diferentes versiones de Wix
      const dateSelectors = [
        'time[datetime]', // Prioridad a elementos time con datetime
        '[data-testid="post-date"]', // Nueva versión
        '[data-hook="post-date"]', // Versión anterior
        '.post-date', // Clase común
        '.blog-post-date', // Otra clase común
        '.date-published', // Dashboard
        '[aria-label*="fecha"], [aria-label*="date"]' // Elementos ARIA
      ];

      // Buscar fechas en toda la página
      dateSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
          try {
            const dateValue = element.getAttribute('datetime') || element.textContent.trim();
            if (dateValue) {
              const dateObj = new Date(dateValue);
              if (!isNaN(dateObj)) {
                const monthId = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                monthSet.add(monthId);
                console.log(`[CONTENT SCRIPT] Fecha encontrada: ${dateValue} -> ${monthId}`);
              }
            }
          } catch (error) {
            console.warn(`[CONTENT SCRIPT] Error procesando fecha con selector ${selector}:`, error);
          }
        });
      });

      // Si no encontramos fechas, intentar método alternativo para dashboard
      if (monthSet.size === 0 && isDashboard) {
        console.log('[CONTENT SCRIPT] Intentando método alternativo para dashboard...');
        document.querySelectorAll('[data-testid="post-item"], [data-hook="post-item"]').forEach(post => {
          const dateElement = post.querySelector('.date, [aria-label*="date"], [title*="date"]');
          if (dateElement) {
            const dateText = dateElement.textContent || dateElement.getAttribute('aria-label') || dateElement.getAttribute('title');
            try {
              const dateObj = new Date(dateText);
              if (!isNaN(dateObj)) {
                const monthId = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                monthSet.add(monthId);
              }
            } catch (error) {
              console.warn('[CONTENT SCRIPT] Error procesando fecha alternativa:', error);
            }
          }
        });
      }

      // Convertir a array ordenado
      const months = Array.from(monthSet)
        .sort((a, b) => b.localeCompare(a)) // Orden descendente
        .map(monthId => {
          const [year, month] = monthId.split('-');
          const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          return {
            id: monthId,
            name: `${monthNames[parseInt(month) - 1]} ${year}`
          };
        });

      console.log('[CONTENT SCRIPT] Meses extraídos:', months);
      return months;

    } catch (error) {
      console.error('[CONTENT SCRIPT] Error crítico al extraer meses:', error);
      return [];
    }
  };

  // Función mejorada para extraer posts de un mes específico
  const extractPostsFromMonth = (monthId) => {
    console.log(`[CONTENT SCRIPT] Extrayendo posts del mes: ${monthId}`);
    const posts = [];
    
    try {
      const [year, month] = monthId.split('-');
      const targetYear = parseInt(year);
      const targetMonth = parseInt(month);
      
      console.log(`[CONTENT SCRIPT] Buscando posts de ${targetMonth}/${targetYear}`);
      console.log(`[CONTENT SCRIPT] URL actual: ${window.location.href}`);
      console.log(`[CONTENT SCRIPT] Es dashboard: ${isDashboard}`);
      
      if (isDashboard && window.location.href.includes('/blog/')) {
        // MÉTODO ESPECÍFICO PARA DASHBOARD DE WIX
        console.log('[CONTENT SCRIPT] Usando método específico para dashboard de Wix');
        
        // PRIORIDAD 1: Buscar en tbody con data-index (estructura específica identificada)
        const tbodyRows = document.querySelectorAll('tbody tr[data-index], tbody [data-index]');
        console.log(`[CONTENT SCRIPT] Encontradas ${tbodyRows.length} filas con data-index en tbody`);
        
        if (tbodyRows.length > 0) {
          tbodyRows.forEach((row, index) => {
            try {
              console.log(`[CONTENT SCRIPT] Procesando fila ${index} con data-index:`, row.getAttribute('data-index'));
              
              // Buscar título en diferentes posibles ubicaciones dentro de la fila
              const titleSelectors = [
                'td:first-child', // Primera columna
                'td:nth-child(1)', // Primera columna específica
                'td:first-child a', // Enlaces en primera columna
                'td:first-child span', // Spans en primera columna
                'td:first-child div', // Divs en primera columna
                '[data-testid="post-title"]',
                '[data-hook="post-title"]',
                '.title',
                'h1, h2, h3, h4, h5, h6',
                'span', // Los títulos podrían estar en spans
                'div'   // O en divs
              ];
              
              let titleElement = null;
              let titleText = '';
              
              for (const titleSelector of titleSelectors) {
                const elements = row.querySelectorAll(titleSelector);
                for (const element of elements) {
                  const text = element.textContent.trim();
                  // Buscar texto que parezca un título de post (más de 5 caracteres, no texto de UI)
                  if (text.length > 5 && 
                      !text.includes('Entradas') &&
                      !text.includes('Filtra') &&
                      !text.includes('Personaliza') &&
                      !text.includes('columnas') &&
                      !text.includes('Estado') &&
                      !text.includes('Fecha') &&
                      !text.includes('Autor') &&
                      !text.includes('Comentarios') &&
                      !text.includes('Vistas')) {
                    titleElement = element;
                    titleText = text;
                    break;
                  }
                }
                if (titleText) break;
              }
              
              if (!titleText) {
                console.log(`[CONTENT SCRIPT] No se encontró título válido en fila ${index}`);
                return;
              }
              
              // Buscar fecha en la fila - MEJORADO para el tercer TD
              const dateSelectors = [
                'td:nth-child(3)', // Tercer TD específicamente
                'td:nth-child(3) button span', // El span dentro del botón
                'td:nth-child(3) .wds_1_198_3_ButtonCore__content', // Clase específica del contenido
                'time[datetime]',
                '[data-testid="post-date"]',
                'td:nth-child(4)', // Cuarta columna como respaldo
                '.date'
              ];
              
              let postDate = new Date();
              let dateText = '';
              
              for (const dateSelector of dateSelectors) {
                const dateElement = row.querySelector(dateSelector);
                if (dateElement && dateElement.textContent.trim()) {
                  dateText = dateElement.textContent.trim();
                  console.log(`[CONTENT SCRIPT] Fecha encontrada: ${dateText}`);
                  
                  // Parsear fecha en formato "24 jun, GMT-6" o similar
                  try {
                    // Limpiar el texto de fecha
                    let cleanDateText = dateText.replace(/GMT[+-]\d+/, '').trim();
                    cleanDateText = cleanDateText.replace(/,$/, ''); // Quitar coma final
                    
                    // Intentar parsear directamente
                    let parsedDate = new Date(cleanDateText);
                    
                    // Si no funciona, intentar convertir mes en español
                    if (isNaN(parsedDate)) {
                      const monthMap = {
                        'ene': 'Jan', 'feb': 'Feb', 'mar': 'Mar', 'abr': 'Apr',
                        'may': 'May', 'jun': 'Jun', 'jul': 'Jul', 'ago': 'Aug',
                        'sep': 'Sep', 'oct': 'Oct', 'nov': 'Nov', 'dic': 'Dec'
                      };
                      
                      let englishDate = cleanDateText;
                      for (const [spanish, english] of Object.entries(monthMap)) {
                        englishDate = englishDate.replace(spanish, english);
                      }
                      
                      parsedDate = new Date(englishDate);
                    }
                    
                    if (!isNaN(parsedDate) && parsedDate.getFullYear() > 2000) {
                      postDate = parsedDate;
                      console.log(`[CONTENT SCRIPT] Fecha parseada: ${postDate.toISOString()}`);
                      break;
                    }
                  } catch (parseError) {
                    console.warn(`[CONTENT SCRIPT] Error parseando fecha "${dateText}":`, parseError);
                  }
                }
              }
              
              // Buscar URL del post
              const linkElement = row.querySelector('td:first-child a[href], a[href*="/post/"], a[href*="/blog/"], a[href]');
              
              // Buscar contenido/descripción
              const contentSelectors = [
                'td:nth-child(2)', // Segunda columna podría ser descripción
                'td:nth-child(4)', // Cuarta columna podría ser descripción
                'td:nth-child(5)', // Quinta columna podría ser descripción
                '.description',
                '.excerpt'
              ];
              
              let contentText = '';
              for (const contentSelector of contentSelectors) {
                const contentElement = row.querySelector(contentSelector);
                if (contentElement && contentElement.textContent.trim().length > titleText.length) {
                  contentText = contentElement.textContent.trim().substring(0, 500);
                  break;
                }
              }
              
              const post = {
                title: titleText,
                content: contentText,
                date: postDate.toISOString(),
                url: linkElement ? linkElement.href : '',
                image: '',
                monthId: monthId,
                extractMethod: 'tbody-data-index',
                index: index,
                dataIndex: row.getAttribute('data-index'),
                originalDateText: dateText // Para debug
              };
              
              posts.push(post);
              console.log(`[CONTENT SCRIPT] Post extraído (tbody):`, post.title, dateText ? `- Fecha: ${dateText}` : '');
              
            } catch (error) {
              console.warn(`[CONTENT SCRIPT] Error procesando fila ${index}:`, error);
            }
          });
        }
        
        // PRIORIDAD 2: Si no encontramos en tbody, buscar otras estructuras de dashboard
        if (posts.length === 0) {
          console.log('[CONTENT SCRIPT] No se encontraron posts en tbody, probando otros selectores de dashboard...');
          
          const dashboardPostSelectors = [
            '[data-testid="blog-post-item"]',
            '[data-hook="blog-post-item"]',
            '.blog-post-item',
            '[data-testid="post-item"]',
            '[data-hook="post-item"]',
            '.post-item',
            'tr[data-testid], tr[data-hook]', // Filas con atributos data pero sin data-index
            '[role="row"]'
          ];
          
          dashboardPostSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            console.log(`[CONTENT SCRIPT] Dashboard alternativo - Encontrados ${elements.length} elementos con selector: ${selector}`);
            
            elements.forEach((element, index) => {
              try {
                const titleElement = element.querySelector('h1, h2, h3, h4, td:first-child, .title, a[href*="/post/"]');
                
                if (titleElement && titleElement.textContent.trim().length > 5) {
                  const titleText = titleElement.textContent.trim();
                  
                  // Filtrar elementos de UI
                  if (titleText.includes('Entradas') || 
                      titleText.includes('Filtra') || 
                      titleText.includes('Personaliza') ||
                      titleText.includes('columnas')) {
                    return;
                  }
                  
                  const post = {
                    title: titleText,
                    content: '',
                    date: new Date().toISOString(),
                    url: '',
                    image: '',
                    monthId: monthId,
                    extractMethod: 'dashboard-alternative',
                    index: index,
                    selector: selector
                  };
                  
                  if (!posts.find(p => p.title === post.title)) {
                    posts.push(post);
                    console.log(`[CONTENT SCRIPT] Post extraído (dashboard alt):`, post.title);
                  }
                }
              } catch (error) {
                console.warn('[CONTENT SCRIPT] Error en dashboard alternativo:', error);
              }
            });
          });
        }
        
      } else {
        // MÉTODO PARA VISTA PÚBLICA
        console.log('[CONTENT SCRIPT] Usando método para vista pública');
        
        const publicPostSelectors = [
          'article',
          '.blog-post',
          '.post-item',
          '[data-testid="post-item"]',
          '[data-hook="post-item"]',
          '.blog-post-preview'
        ];
        
        publicPostSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          console.log(`[CONTENT SCRIPT] Vista pública - Encontrados ${elements.length} elementos con selector: ${selector}`);
          
          elements.forEach((element, index) => {
            try {
              const titleElement = element.querySelector('h1, h2, h3, h4, .title, .post-title, [data-testid="post-title"]');
              const dateElement = element.querySelector('time[datetime], [data-testid="post-date"], [data-hook="post-date"], .post-date');
              const linkElement = element.querySelector('a[href]') || element.closest('a[href]');
              const contentElement = element.querySelector('.post-content, .post-excerpt, p');
              const imageElement = element.querySelector('img');
              
              if (titleElement && titleElement.textContent.trim()) {
                let postDate = new Date();
                if (dateElement) {
                  const dateValue = dateElement.getAttribute('datetime') || dateElement.textContent.trim();
                  const parsedDate = new Date(dateValue);
                  if (!isNaN(parsedDate)) {
                    postDate = parsedDate;
                  }
                }
                
                const post = {
                  title: titleElement.textContent.trim(),
                  content: contentElement ? contentElement.textContent.trim().substring(0, 500) : '',
                  date: postDate.toISOString(),
                  url: linkElement ? linkElement.href : '',
                  image: imageElement ? imageElement.src : '',
                  monthId: monthId,
                  extractMethod: 'public',
                  index: index,
                  selector: selector
                };
                
                if (!posts.find(p => p.title === post.title)) {
                  posts.push(post);
                  console.log(`[CONTENT SCRIPT] Post extraído (público):`, post.title);
                }
              }
            } catch (error) {
              console.warn('[CONTENT SCRIPT] Error procesando elemento público:', error);
            }
          });
        });
      }
      
      // MÉTODO DE RESPALDO: Buscar por texto visible que parezca títulos de blog
      if (posts.length === 0) {
        console.log('[CONTENT SCRIPT] Usando método de respaldo por texto...');
        
        const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        allHeadings.forEach((heading, index) => {
          const text = heading.textContent.trim();
          
          // Filtrar títulos que no sean del menú
          if (text.length > 5 && 
              !text.includes('Blog') ||
              !text.includes('Resumen') ||
              !text.includes('Entradas') ||
              !text.includes('Comentarios') ||
              !text.includes('Categorías')) {
            
            const post = {
              title: text,
              content: '',
              date: new Date().toISOString(),
              url: '',
              image: '',
              monthId: monthId,
              extractMethod: 'headings',
              index: index
            };
            
            posts.push(post);
            console.log(`[CONTENT SCRIPT] Post extraído (headings):`, post.title);
          }
        });
      }
      
      // Log final
      console.log(`[CONTENT SCRIPT] Total posts extraídos para ${monthId}: ${posts.length}`);
      if (posts.length > 0) {
        console.log('[CONTENT SCRIPT] Posts encontrados:', posts.map(p => ({ title: p.title, method: p.extractMethod })));
      } else {
        console.warn('[CONTENT SCRIPT] No se encontraron posts. Información de debug:');
        console.log('- URL actual:', window.location.href);
        console.log('- Es dashboard:', isDashboard);
        console.log('- Total de filas de tabla:', document.querySelectorAll('tr, [role="row"]').length);
        console.log('- Total de elementos con "post":', document.querySelectorAll('[class*="post"], [data-testid*="post"], [data-hook*="post"]').length);
        console.log('- Total de headings:', document.querySelectorAll('h1, h2, h3, h4, h5, h6').length);
      }
      
      return posts;
      
    } catch (error) {
      console.error(`[CONTENT SCRIPT] Error crítico extrayendo posts de ${monthId}:`, error);
      return [];
    }
  };

  // Manejar mensajes
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getAvailableMonths') {
      try {
        const months = extractAvailableMonths();
        
        // Si no hay meses, devolver los últimos 3 meses como respaldo
        if (months.length === 0) {
          const currentDate = new Date();
          const defaultMonths = [
            { id: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`, name: 'Mes actual' },
            { id: `${currentDate.getFullYear()}-${String(currentDate.getMonth()).padStart(2, '0')}`, name: 'Mes anterior' },
            { id: `${currentDate.getFullYear()}-${String(currentDate.getMonth() - 1).padStart(2, '0')}`, name: 'Hace dos meses' }
          ].filter(m => !m.id.includes('NaN'));
          
          console.log('[CONTENT SCRIPT] Usando meses por defecto:', defaultMonths);
          sendResponse({ success: true, months: defaultMonths, isDefault: true });
        } else {
          sendResponse({ success: true, months });
        }
      } catch (error) {
        console.error('[CONTENT SCRIPT] Error al procesar getAvailableMonths:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // Respuesta asíncrona
    }
    
    if (request.action === 'exportPosts') {
      try {
        const posts = extractPostsFromMonth(request.monthId);
        sendResponse({ success: true, posts });
      } catch (error) {
        console.error('[CONTENT SCRIPT] Error al exportar posts:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // Respuesta asíncrona
    }
    
    if (request.action === 'debugInfo') {
      try {
        const tbodyDataIndex = document.querySelectorAll('tbody tr[data-index], tbody [data-index]');
        const info = {
          url: window.location.href,
          articles: document.querySelectorAll('article').length,
          posts: document.querySelectorAll('[class*="post"], [data-testid*="post"], [data-hook*="post"]').length,
          blogLinks: document.querySelectorAll('a[href*="/post/"], a[href*="/blog/"], a[href*="blog"]').length,
          dates: document.querySelectorAll('time[datetime], [data-testid="post-date"], [data-hook="post-date"], .post-date, .blog-post-date').length,
          titles: document.querySelectorAll('h1, h2, h3, h4, .title, .post-title, [data-testid="post-title"]').length,
          isDashboard: window.location.href.includes('/dashboard/') || window.location.href.includes('/editor/'),
          domain: window.location.hostname,
          // Información específica del dashboard
          tableRows: document.querySelectorAll('tbody tr, [role="row"]').length,
          blogPostItems: document.querySelectorAll('[data-testid="blog-post-item"], [data-hook="blog-post-item"]').length,
          isInBlogSection: window.location.href.includes('/blog/'),
          allHeadings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
          // Nueva información específica sobre data-index
          tbodyDataIndexRows: tbodyDataIndex.length,
          dataIndexSample: Array.from(tbodyDataIndex.slice(0, 3)).map((row, i) => ({
            index: i,
            dataIndex: row.getAttribute('data-index'),
            firstCellText: row.querySelector('td:first-child')?.textContent.trim().substring(0, 50) || 'N/A',
            allCellsCount: row.querySelectorAll('td').length
          }))
        };
        
        console.log('[CONTENT SCRIPT] Debug info recopilada:', info);
        console.log('[CONTENT SCRIPT] Muestra de filas con data-index:', info.dataIndexSample);
        sendResponse({ success: true, info });
      } catch (error) {
        console.error('[CONTENT SCRIPT] Error obteniendo debug info:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // Respuesta asíncrona
    }
  });
}