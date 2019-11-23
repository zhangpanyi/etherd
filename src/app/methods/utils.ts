const BadRequest = {
    code: -32602,
    message: 'Bad request'
}

const InvalidToken = {
    code: -32602,
    message: 'Invalid token symbol'
}

export function arrayToObject(keys: string[], params: any[]) {
    let obj = Object.create(null)
    for (let idx = 0; idx < params.length; idx++) {
        if (idx >= keys.length) {
            break
        }
        obj[keys[idx]] = params[idx]
    }
    return obj
}

export { BadRequest, InvalidToken }
