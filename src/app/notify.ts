import { logger } from '@pkg/logger'
import { nothrow } from '@pkg/promise'
import * as request from 'request-promise'

export interface Message {
    type: string
    symbol: string
    from: string
    to: string
    hash: string | null
    amount: string
    blockNumber: number | null
}

export async function postNotify(url: string | null | undefined, msg: Message) {
    if (!url) {
        return
    }
    let response = await nothrow(request.post(url, {
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(msg)
    }).promise())
    if (response.error) {
        logger.error('[notify] failed to post notify: %s, %s', response.error.message, JSON.stringify(msg))
    }
}
