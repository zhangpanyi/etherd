import {
    BaseEntity,
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    FindManyOptions
} from 'typeorm'

enum Type { SendFee = 1, Collect = 2 }

@Entity()
class ToDo extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    id: number | undefined

    @Column()
    type: number = 0

    @Column()
    params: string = ''

    @Column()
    count: number = 0

    @Column()
    done: boolean = false
    
    @CreateDateColumn({type: 'date'})
    created_at: Date = new Date()

    @UpdateDateColumn({type: 'date'})
    updated_at: Date = new Date()
}

class ToDoDao {
    async first() {
        const options: FindManyOptions = {
            where: {done: false},
            order: {id: 'ASC'}
        }
        return await ToDo.findOne(options)
    }

    async setDone(id: number, count: number) {
        return await ToDo.getRepository().update({id: id}, {done: true, count})
    }
}

export { ToDo, ToDoDao, Type }
