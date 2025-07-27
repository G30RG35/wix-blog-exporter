document.addEventListener('DOMContentLoaded', function() {
  // Elementos del DOM
  const statusDiv = document.getElementById('status');
  const monthSelect = document.getElementById('monthSelect');
  const yearSelect = document.getElementById('yearSelect');
  const exportButton = document.getElementById('exportButton');
  const debugButton = document.getElementById('debugButton');
  const debugInfo = document.getElementById('debugInfo');
  const dateFilterRadios = document.querySelectorAll('input[name="dateFilter"]');
  const monthSelector = document.querySelector('.month-selector');
  const dateRange = document.querySelector('.date-range');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const quickOptions = document.querySelectorAll('.quick-option');

  // Inicializar selectores de año (últimos 5 años + próximos 2)
  function initializeYearSelector() {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    
    yearSelect.innerHTML = '';
    
    // Añadir años desde hace 5 años hasta dentro de 2 años
    for (let year = currentYear - 5; year <= currentYear + 2; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === currentYear) {
        option.selected = true;
      }
      yearSelect.appendChild(option);
    }
    
    // Seleccionar el mes actual por defecto
    monthSelect.value = String(currentMonth).padStart(2, '0');
  }

  // Configurar fechas por defecto
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  endDateInput.valueAsDate = today;
  startDateInput.valueAsDate = thirtyDaysAgo;

  // Manejar cambio de tipo de filtro
  dateFilterRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      const filterType = this.value;
      
      // Mostrar/ocultar secciones apropiadas
      monthSelector.classList.toggle('active', filterType === 'month');
      dateRange.classList.toggle('active', filterType === 'range');
      
      // Habilitar/deshabilitar botón de exportar
      updateExportButtonState();
    });
  });

  // Manejar opciones rápidas de fecha
  quickOptions.forEach(button => {
    button.addEventListener('click', function() {
      const days = parseInt(this.dataset.days);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);
      
      startDateInput.valueAsDate = startDate;
      endDateInput.valueAsDate = endDate;
      
      // Seleccionar el radio de rango personalizado
      document.querySelector('input[value="range"]').checked = true;
      monthSelector.classList.remove('active');
      dateRange.classList.add('active');
      
      updateExportButtonState();
    });
  });

  // Manejar cambios en las fechas y selectores
  [startDateInput, endDateInput, monthSelect, yearSelect].forEach(input => {
    input.addEventListener('change', updateExportButtonState);
  });

  function updateExportButtonState() {
    const selectedFilter = document.querySelector('input[name="dateFilter"]:checked').value;
    let isValid = false;
    
    switch(selectedFilter) {
      case 'month':
        isValid = monthSelect.value !== '' && yearSelect.value !== '';
        break;
      case 'range':
        isValid = startDateInput.value && endDateInput.value && 
                 new Date(startDateInput.value) <= new Date(endDateInput.value);
        break;
      case 'all':
        isValid = true;
        break;
    }
    
    exportButton.disabled = !isValid;
  }

  function updateStatus(message, type = 'loading') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
  }

  function getMonthId() {
    const month = monthSelect.value;
    const year = yearSelect.value;
    return `${year}-${month}`;
  }

  function getMonthName() {
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const monthIndex = parseInt(monthSelect.value) - 1;
    return `${monthNames[monthIndex]} ${yearSelect.value}`;
  }

  // Función mejorada de exportación
  async function setupExportButton() {
    exportButton.addEventListener('click', async function() {
      try {
        const selectedFilter = document.querySelector('input[name="dateFilter"]:checked').value;
        exportButton.disabled = true;
        updateStatus('Exportando posts...', 'loading');

        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        // Verificar que estamos en Wix
        if (!tab.url.includes('wix.com')) {
          updateStatus('Por favor, navega a tu dashboard de Wix primero', 'error');
          return;
        }

        let exportData = { entradas: [] };
        
        switch(selectedFilter) {
          case 'month':
            const monthId = getMonthId();
            updateStatus(`Exportando posts de ${getMonthName()}...`, 'loading');
            
            const monthResponse = await chrome.tabs.sendMessage(tab.id, {
              action: 'exportPosts',
              monthId: monthId
            });
            
            if (monthResponse && monthResponse.success) {
              exportData = monthResponse.data;
            } else {
              throw new Error(monthResponse?.error || 'Error exportando posts del mes');
            }
            break;
            
          case 'range':
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;
            
            if (!startDate || !endDate) {
              updateStatus('Por favor selecciona fechas válidas', 'error');
              return;
            }
            
            updateStatus(`Exportando posts desde ${startDate} hasta ${endDate}...`, 'loading');
            
            const rangeResponse = await chrome.tabs.sendMessage(tab.id, {
              action: 'exportPostsByDateRange',
              startDate: startDate,
              endDate: endDate
            });
            
            if (rangeResponse && rangeResponse.success) {
              exportData = rangeResponse.data;
            } else {
              throw new Error(rangeResponse?.error || 'Error exportando posts por rango');
            }
            break;
            
          case 'all':
            updateStatus('Exportando todos los posts disponibles...', 'loading');
            
            const allResponse = await chrome.tabs.sendMessage(tab.id, {
              action: 'exportAllPosts'
            });
            
            if (allResponse && allResponse.success) {
              exportData = allResponse.data;
            } else {
              throw new Error(allResponse?.error || 'Error exportando todos los posts');
            }
            break;
        }

        if (exportData.entradas && exportData.entradas.length > 0) {
          const totalPosts = exportData.entradas.reduce((sum, entrada) => sum + entrada.notas.length, 0);
          
          // Crear archivo JSON
          const jsonString = JSON.stringify(exportData, null, 2);
          const blob = new Blob([jsonString], {type: 'application/json'});
          const url = URL.createObjectURL(blob);
          
          // Generar nombre de archivo basado en el filtro
          let filename = 'wix-blog-export';
          switch(selectedFilter) {
            case 'month':
              filename += `-${getMonthName().replace(/\s+/g, '-')}`;
              break;
            case 'range':
              filename += `-${startDateInput.value}_${endDateInput.value}`;
              break;
            case 'all':
              filename += '-completo';
              break;
          }
          filename += '.json';
          
          // Descargar archivo
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          updateStatus(`✅ ${totalPosts} posts exportados exitosamente en ${exportData.entradas.length} fechas diferentes`, 'success');
        } else {
          updateStatus('No se encontraron posts en el período seleccionado', 'error');
        }
        
      } catch (error) {
        console.error('Error durante la exportación:', error);
        updateStatus('Error durante la exportación: ' + error.message, 'error');
      } finally {
        exportButton.disabled = false;
        updateExportButtonState();
      }
    });
  }

  // Función de debug
  function setupDebugButton() {
    debugButton.addEventListener('click', async function() {
      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'debugInfo'
        });

        if (response && response.success) {
          const info = response.info;
          debugInfo.innerHTML = `
            <strong>Debug Information:</strong><br>
            URL: ${info.url}<br>
            Es Dashboard: ${info.isDashboard}<br>
            Dominio: ${info.domain}<br>
            En sección blog: ${info.isInBlogSection}<br><br>
            
            <strong>Elementos encontrados:</strong><br>
            Articles: ${info.articles}<br>
            Posts: ${info.posts}<br>
            Blog Links: ${info.blogLinks}<br>
            Fechas: ${info.dates}<br>
            Títulos: ${info.titles}<br>
            Filas de tabla: ${info.tableRows}<br>
            Blog post items: ${info.blogPostItems}<br>
            Headings: ${info.allHeadings}<br><br>
            
            <strong>Filas data-index:</strong><br>
            Total: ${info.tbodyDataIndexRows}<br>
            ${info.dataIndexSample.map(sample => 
              `Fila ${sample.index}: [${sample.dataIndex}] "${sample.firstCellText}" (${sample.allCellsCount} celdas)`
            ).join('<br>')}<br><br>
            
            <strong>Configuración actual:</strong><br>
            Mes seleccionado: ${getMonthName()}<br>
            Month ID: ${getMonthId()}
          `;
          debugInfo.style.display = 'block';
        } else {
          debugInfo.innerHTML = `<strong>Error:</strong> ${response?.error || 'No se pudo obtener información de debug'}`;
          debugInfo.style.display = 'block';
        }
      } catch (error) {
        debugInfo.innerHTML = `<strong>Error de comunicación:</strong> ${error.message}`;
        debugInfo.style.display = 'block';
      }
    });
  }

  // Inicializar todo
  initializeYearSelector();
  updateStatus('✅ Listo para exportar. Selecciona el período deseado.', 'success');
  updateExportButtonState();
  setupExportButton();
  setupDebugButton();
});
