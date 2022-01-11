import {createLogger, format, transports} from 'winston';
import {LoggingWinston} from '@google-cloud/logging-winston';

const isLocalEnvironment = process.env.GCP_PROJECT ? false : true;
const projectId = isLocalEnvironment ? 'localhost' : process.env.GCP_PROJECT;
const serviceName = isLocalEnvironment ? 'localhost' : process.env.K_SERVICE;

const loggingWinston = new LoggingWinston({
    logName: `${serviceName}-FeathersArangoAdapter-logs`,
    serviceContext: {
        service: serviceName,
    },
    resource: {
        type: 'cloud_run_revision',
        labels: {
            project_id: projectId,
            service_name: serviceName,
            configuration_name: serviceName,
        } as {},
    },
});

const logger = createLogger({
    level: 'debug',
    format: format.combine(format.splat(), format.simple()),
    transports: isLocalEnvironment ? [new transports.Console()] : [loggingWinston],
});

logger.debug('Feathers-Arangodb adapter logger initialized', {isLocal: isLocalEnvironment, projectId, serviceName, gcp: process.env.GCP_PROJECT, envVars: process.env});
export default logger;
