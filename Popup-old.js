document.addEventListener("DOMContentLoaded", async () => {
  console.log("[POPUP] Inicializando...");

  // Elementos UI con verificación
  const statusEl = document.getElementById("status");
  const exportBtn = document.getElementById("exportBtn");
  const monthSelector = document.getElementById("monthSelector");
  const loadingEl = document.getElementById("loading");
  const selectAllBtn = document.getElementById("selectAllBtn");
  const debugBtn = document.getElementById("debugBtn");

  if (
    !statusEl ||
    !exportBtn ||
    !monthSelector ||
    !loadingEl ||
    !selectAllBtn ||
    !debugBtn
  ) {
    console.error("[POPUP] Error: Elementos del DOM no encontrados");
    return;
  }

  // Función mejorada para cargar meses
  const loadAvailableMonths = async () => {
    loadingEl.style.display = "block";
    monthSelector.innerHTML = "";
    statusEl.textContent = "Buscando meses disponibles...";

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (
        !tab?.url ||
        (!tab.url.includes("wix.com") && !tab.url.includes("wixsite.com"))
      ) {
        throw new Error("Por favor, abre tu blog de Wix primero");
      }

      // Verificar si está en la sección correcta
      if (tab.url.includes("/dashboard/") && !tab.url.includes("/blog/")) {
        throw new Error(
          'Ve a la sección "Blog" → "Entradas" en tu dashboard de Wix para ver los posts'
        );
      }

      // Inyectar content script si es necesario
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        });
        await new Promise((resolve) => setTimeout(resolve, 800)); // Esperar generosamente
      } catch (injectError) {
        console.warn("[POPUP] Error al inyectar content script:", injectError);
      }

      // Obtener meses
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "getAvailableMonths",
      });

      if (!response) {
        throw new Error("El blog no respondió. Intenta recargar la página.");
      }

      if (response.success) {
        return response.months;
      } else {
        throw new Error(response.error || "No se pudieron obtener los meses");
      }
    } catch (error) {
      console.error("[POPUP] Error al cargar meses:", error);
      statusEl.innerHTML = `<span style="color: red;">${error.message}</span>`;
      return [];
    } finally {
      loadingEl.style.display = "none";
    }
  };

  // Mostrar meses en la UI
  const renderMonths = (months) => {
    monthSelector.innerHTML = "";

    if (!months || months.length === 0) {
      monthSelector.innerHTML = `
        <div class="error">
          <p><strong>No se encontraron meses con posts.</strong></p>
          <p>Para usar esta extensión:</p>
          <ol style="text-align: left; font-size: 12px;">
            <li>Ve a tu <strong>Dashboard de Wix</strong></li>
            <li>Entra en <strong>"Blog"</strong> en el menú lateral</li>
            <li>Haz clic en <strong>"Entradas"</strong></li>
            <li>Vuelve a abrir esta extensión</li>
          </ol>
          <p style="font-size: 11px; color: #666;">También puedes probarlo en la vista pública de tu blog.</p>
        </div>
      `;
      return;
    }

    months.forEach((month) => {
      const div = document.createElement("div");
      div.className = "month-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `month-${month.id}`;
      checkbox.value = month.id;
      checkbox.checked = true;

      const label = document.createElement("label");
      label.htmlFor = `month-${month.id}`;
      label.textContent = month.name;

      div.appendChild(checkbox);
      div.appendChild(label);
      monthSelector.appendChild(div);
    });

    statusEl.textContent = `Meses disponibles: ${months.length}`;
  };

  // Configurar botón "Seleccionar Todos"
  const setupSelectAllButton = () => {
    selectAllBtn.textContent = "Deseleccionar Todos";
    selectAllBtn.addEventListener("click", () => {
      const checkboxes = monthSelector.querySelectorAll(
        'input[type="checkbox"]'
      );
      const allChecked = Array.from(checkboxes).every((cb) => cb.checked);

      checkboxes.forEach((cb) => {
        cb.checked = !allChecked;
      });

      selectAllBtn.textContent = allChecked
        ? "Seleccionar Todos"
        : "Deseleccionar Todos";
    });
  };

  // Configurar botón de exportar
  const setupExportButton = () => {
    exportBtn.addEventListener("click", async () => {
      const selectedMonths = Array.from(
        monthSelector.querySelectorAll('input[type="checkbox"]:checked')
      ).map((cb) => cb.value);

      if (selectedMonths.length === 0) {
        statusEl.innerHTML =
          '<span style="color: red;">Por favor, selecciona al menos un mes para exportar</span>';
        return;
      }

      exportBtn.disabled = true;
      loadingEl.style.display = "block";
      statusEl.textContent = "Exportando posts...";

      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        console.log(
          "[POPUP] Iniciando exportación para meses:",
          selectedMonths
        );

        // Exportar cada mes seleccionado
        let allData = { entradas: [] };
        let totalProcessed = 0;

        for (const monthId of selectedMonths) {
          statusEl.textContent = `Exportando ${monthId}... (${
            totalProcessed + 1
          }/${selectedMonths.length})`;

          console.log(`[POPUP] Enviando mensaje para exportar ${monthId}`);

          const response = await chrome.tabs.sendMessage(tab.id, {
            action: "exportPosts",
            monthId: monthId,
          });

          console.log(`[POPUP] Respuesta para ${monthId}:`, response);

          if (response && response.success && response.data) {
            // Combinar las entradas de todos los meses
            if (response.data.entradas && response.data.entradas.length > 0) {
              allData.entradas = allData.entradas.concat(response.data.entradas);
              console.log(
                `[POPUP] Entradas añadidas de ${monthId}: ${response.data.entradas.length}`
              );
            }
          } else {
            console.warn(
              `[POPUP] Error exportando ${monthId}:`,
              response?.error || "Sin respuesta"
            );
            statusEl.innerHTML = `<span style="color: orange;">⚠️ Error en ${monthId}: ${
              response?.error || "Sin respuesta"
            }</span>`;
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Pausa para mostrar el error
          }

          totalProcessed++;
        }

        console.log(`[POPUP] Total entradas recopiladas: ${allData.entradas.length}`);

        if (allData.entradas.length > 0) {
          // Descargar como JSON
          const dataStr = JSON.stringify(allData, null, 2);
          const dataBlob = new Blob([dataStr], { type: "application/json" });
          const url = URL.createObjectURL(dataBlob);

          const a = document.createElement("a");
          a.href = url;
          a.download = `wix-blog-export-${
            new Date().toISOString().split("T")[0]
          }.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          const totalNotas = allData.entradas.reduce((total, entrada) => total + entrada.notas.length, 0);
          statusEl.innerHTML = `<span style="color: green;">✅ Exportadas ${allData.entradas.length} fechas con ${totalNotas} notas correctamente</span>`;

          // Mostrar detalles de las entradas exportadas
          console.log(
            "[POPUP] Entradas exportadas:",
            allData.entradas.map((e) => ({ fecha: e.fecha, notas: e.notas.length }))
          );
        } else {
          statusEl.innerHTML =
            '<span style="color: orange;">⚠️ No se encontraron entradas para exportar. Verifica la consola para más detalles.</span>';
          console.warn(
            "[POPUP] No se encontraron entradas. Revisa la consola del content script para más información."
          );
        }
      } catch (error) {
        console.error("[POPUP] Error durante la exportación:", error);
        statusEl.innerHTML = `<span style="color: red;">Error: ${error.message}</span>`;
      } finally {
        exportBtn.disabled = false;
        loadingEl.style.display = "none";
      }
    });
  };

  // Configurar botón de debug
  const setupDebugButton = () => {
    debugBtn.addEventListener("click", async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        statusEl.textContent = "Obteniendo información de debug...";

        const debugResponse = await chrome.tabs.sendMessage(tab.id, {
          action: "debugInfo",
        });

        if (debugResponse && debugResponse.success) {
          const info = debugResponse.info;
          const debugText = `
🌐 URL: ${info.url}
� En sección blog: ${info.isInBlogSection ? "SÍ" : "NO"}
�📄 Elementos encontrados:
  • Articles: ${info.articles}
  • Posts: ${info.posts}  
  • Filas tabla: ${info.tableRows}
  • 🎯 Filas data-index: ${info.tbodyDataIndexRows}
  • Blog items: ${info.blogPostItems}
  • Enlaces blog: ${info.blogLinks}
  • Fechas: ${info.dates}
  • Títulos: ${info.titles}

${
  info.dataIndexSample && info.dataIndexSample.length > 0
    ? `📝 Muestra de entradas:
${info.dataIndexSample
  .map(
    (sample) =>
      `  ${sample.dataIndex}: "${sample.firstCellText}" (${sample.allCellsCount} cols)`
  )
  .join("\n")}`
    : ""
}

${
  info.isDashboard && !info.isInBlogSection
    ? "⚠️ Ve a Blog → Entradas en tu dashboard"
    : ""
}
          `.trim();

          console.log("[POPUP] Debug Info:", info);
          statusEl.innerHTML = `<pre style="font-size: 9px; background: #f5f5f5; padding: 8px; border-radius: 4px; max-height: 250px; overflow-y: auto; line-height: 1.3;">${debugText}</pre>`;
        } else {
          statusEl.innerHTML =
            '<span style="color: red;">Error obteniendo info de debug</span>';
        }
      } catch (error) {
        console.error("[POPUP] Error en debug:", error);
        statusEl.innerHTML = `<span style="color: red;">Error: ${error.message}</span>`;
      }
    });
  };

  // Inicialización
  try {
    const availableMonths = await loadAvailableMonths();
    renderMonths(availableMonths);
    setupSelectAllButton();
    setupExportButton();
    setupDebugButton();
    exportBtn.disabled = false;

    console.log("[POPUP] Meses cargados correctamente:", availableMonths);
  } catch (error) {
    console.error("[POPUP] Error de inicialización:", error);
    statusEl.innerHTML = `<span style="color: red;">Error inicial: ${error.message}</span>`;
  }
});
