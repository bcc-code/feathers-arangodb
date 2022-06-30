import {createLogger, format, transports} from 'winston';
import {LoggingWinston} from '@google-cloud/logging-winston';

const isLocalEnvironment = process.env.NODE_ENV !== 'production';
const serviceName = isLocalEnvironment ? 'development' : process.env.K_SERVICE;
const desiredLogLevel = process.env.LOGGING_LEVEL || 'debug';

const logFormat = format.printf(function(info) {
  const { level, message, ...json } = info;
  return `${level}: ${message} ${JSON.stringify(json, null, 4)}\n`;
});

const consoleTransport = new transports.Console({
    level: desiredLogLevel,
    format: format.combine(
      format.colorize(),
      logFormat,
    ),
});

const loggingWinston = new LoggingWinston({
    level: desiredLogLevel,
    logName: `${serviceName}-FeathersArangoAdapter-logs`,
});

const logger = createLogger({
    transports: isLocalEnvironment ? [consoleTransport] : [loggingWinston],
});

logger.level = desiredLogLevel;
export default logger;
