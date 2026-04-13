function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('JHEP System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Global data storage using PropertiesService
 */
function saveData(data) {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty('jhep_data', data);
  return true;
}

function loadData() {
  const userProperties = PropertiesService.getUserProperties();
  return userProperties.getProperty('jhep_data') || '{}';
}
