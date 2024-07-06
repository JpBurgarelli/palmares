import CoreDomain, { defineSettings } from '@palmares/core';
import TestsDomain, { TestAdapter } from '@palmares/tests';

import NodeStd from '@palmares/node-std';
import LoggingDomain from '@palmares/logging';
import ConsoleLogging from '@palmares/console-logging';

import { dirname, resolve } from 'path';

export default defineSettings({
  basePath: dirname(resolve(__dirname)),
  settingsLocation: __filename,
  std: NodeStd,
  installedDomains: [
    [
      LoggingDomain,
      {
        logger: ConsoleLogging,
      },
    ],
    // Domain Core, required for palmares to worka
    [
      CoreDomain,
      {
        appName: 'example',
      },
    ],
    [
      TestsDomain,
      {
        testAdapter: TestAdapter
      }
    ],
  ],
});
