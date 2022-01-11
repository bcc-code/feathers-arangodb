import {createLogger, format, transports} from 'winston';
import {LoggingWinston} from '@google-cloud/logging-winston';

const isLocalEnvironment = process.env.K_SERVICE ? false : true;
const serviceName = process.env.K_SERVICE ?? 'localhost';

const loggingWinston = new LoggingWinston({
    logName: `${serviceName}-FeathersArangoAdapter-logs`,
    serviceContext: {
        service: serviceName,
    },
    resource: {
        type: 'cloud_run_revision',
        labels: {
          service_name: serviceName,
          revision_name: process.env.K_REVISION ?? '',
          configuration: process.env.K_CONFIGURATION ?? '',
        }
    },
    labels: {
        component: 'FeathersArangoAdapter',
        service: serviceName,
    } as {},
});

const logger = createLogger({
    level: 'debug',
    format: format.combine(format.splat(), format.simple()),
    transports: isLocalEnvironment ? [new transports.Console()] : [loggingWinston],
});

export default logger;
