import 'reflect-metadata'
import { ConnectionOptions, createConnection } from 'typeorm'
import { ToDo } from '@app/models/todo'
import { Block } from '@app/models/block'
import { Token } from '@app/models/token'
import { Transaction } from '@app/models/transaction'
import * as serverConfig from '@configs/server.json'

async function openConnect(network: string) {
    const options: ConnectionOptions = {
        type: 'sqlite',
        database: serverConfig.datadir + `/${network}.sqlite`,
        entities: [ ToDo, Block, Token, Transaction ],
        logging: false
    }

    const connection = await createConnection(options)
    await connection.synchronize()
}

export { openConnect }
