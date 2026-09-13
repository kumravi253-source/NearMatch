const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = 'NearMatch AdMob Kotlin metadata compatibility';
const FLAG = '-Xskip-metadata-version-check';

function withGoogleMobileAdsKotlinFix(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.contents.includes(MARKER)) {
      return config;
    }

    config.modResults.contents += `
// ${MARKER}: play-services-ads 25.x ships Kotlin 2.3 metadata while
// Expo SDK 57 / RN 0.86 compile with Kotlin 2.1.
gradle.projectsEvaluated {
  rootProject.subprojects { subproject ->
    subproject.tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach { task ->
      task.kotlinOptions.freeCompilerArgs += ["${FLAG}"]
    }
  }
}
`;
    return config;
  });
}

module.exports = withGoogleMobileAdsKotlinFix;
