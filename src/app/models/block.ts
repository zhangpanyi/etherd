import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, Index } from "typeorm"

@Entity()
class Block extends BaseEntity {
    @PrimaryGeneratedColumn("increment")
    id: number | undefined

    @Column()
    heigth: number = 0
}

class BlockDao {
    async update(heigth: number) {
        return await Block.getRepository().update({}, {heigth})
    }

    async createOrFirst() {
        let record = await Block.findOne()
        if (record) {
            return record
        }
        
        record = new Block()
        record.heigth = 0
        return await Block.save(record)
    }
}

export { Block, BlockDao }
