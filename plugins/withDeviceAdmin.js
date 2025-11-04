const { withAndroidManifest, AndroidConfig, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withDeviceAdmin = (config) => {
  // 1) Modify AndroidManifest
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const { manifest } = androidManifest;

    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.BIND_DEVICE_ADMIN',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.DISABLE_KEYGUARD',
      'android.permission.REORDER_TASKS',
      'android.permission.FOREGROUND_SERVICE',
    ];

    permissions.forEach((permission) => {
      if (!manifest['uses-permission'].find((p) => p.$['android:name'] === permission)) {
        manifest['uses-permission'].push({ $: { 'android:name': permission } });
      }
    });

    const application = manifest.application[0];
    if (!application.receiver) application.receiver = [];

    application.receiver.push({
      $: {
        'android:name': '.AdminReceiver',
        'android:permission': 'android.permission.BIND_DEVICE_ADMIN',
        'android:exported': 'true',
      },
      'meta-data': [
        { $: { 'android:name': 'android.app.device_admin', 'android:resource': '@xml/device_admin' } },
      ],
      'intent-filter': [
        { action: [{ $: { 'android:name': 'android.app.action.DEVICE_ADMIN_ENABLED' } }] },
      ],
    });

    return config;
  });

  // 2) Write required files into android project (res/xml + AdminReceiver.java)
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const androidPackage = AndroidConfig.Package.getPackage(config);
      const projectRoot = config.modRequest.platformProjectRoot; // <project>/android

      // Ensure device_admin.xml
      const xmlDir = path.join(projectRoot, 'app', 'src', 'main', 'res', 'xml');
      const xmlFile = path.join(xmlDir, 'device_admin.xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>\n<device-admin xmlns:android="http://schemas.android.com/apk/res/android">\n    <uses-policies>\n        <limit-password />\n        <watch-login />\n        <reset-password />\n        <force-lock />\n        <wipe-data />\n        <expire-password />\n        <encrypted-storage />\n        <disable-camera />\n    </uses-policies>\n</device-admin>\n`;
      fs.writeFileSync(xmlFile, xmlContent, 'utf8');

      // Ensure AdminReceiver.java
      const pkgPath = androidPackage ? androidPackage.split('.').join(path.sep) : path.join('com','devicelock','customer');
      const javaDir = path.join(projectRoot, 'app', 'src', 'main', 'java', pkgPath);
      const javaFile = path.join(javaDir, 'AdminReceiver.java');
      fs.mkdirSync(javaDir, { recursive: true });
      const javaContent = `package ${androidPackage || 'com.devicelock.customer'};\n\nimport android.content.Context;\nimport android.content.Intent;\n\npublic class AdminReceiver extends android.app.admin.DeviceAdminReceiver {\n    @Override\n    public void onEnabled(Context context, Intent intent) {\n        super.onEnabled(context, intent);\n    }\n\n    @Override\n    public void onDisabled(Context context, Intent intent) {\n        super.onDisabled(context, intent);\n    }\n}\n`;
      fs.writeFileSync(javaFile, javaContent, 'utf8');

      return config;
    },
  ]);

  return config;
};

module.exports = withDeviceAdmin;
