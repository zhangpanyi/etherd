import { configure, getLogger } from 'log4js'

configure({
    appenders: {
        file: {
            type: 'dateFile',
            filename: './logs/log',
            encoding: 'utf-8',
            maxLogSize: 1024 * 1024 * 10,
            alwaysIncludePattern: true,
            pattern: '-yyyy-MM-dd-hh.log'
        },
        filter: {
            type: 'logLevelFilter',
            level: "info",
            appender: 'file'
        },
        console: { type: 'console' }
    },
    categories: {
        default: { appenders: ['console', 'filter'], level: 'all' }
    }
})

let logger = getLogger()
export { logger }