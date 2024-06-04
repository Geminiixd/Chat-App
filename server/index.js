import express from 'express'
import { Server } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)



const PORT = process.env.PORT || 3500

const ADMIN = "Admin"

const app = express()

app.use(express.static(path.join(__dirname, 'public')))

const expressServer = app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
})

//state 

const usersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray
    }
}

const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5500", "http://127.0.0.1:5500"]
    }
})




io.on('connection', socket => {
    console.log(`User: ${socket.id} connected`)
    // Upon connection - only to user

    socket.emit('message', buildMsg(ADMIN, 'Welcome to the Chat App!'))

    socket.on('enterRoom', ({ name, room }) => {
        const prevRoom = getUser(socket.id)?.room

        if (prevRoom) {
            socket.leave(prevRoom)
            io.to(prevRoom).emit('message', buildMsg(ADMIN, `${name} has left the room`))
        }

        const user = activateUser(socket.id, name, room)

        if (prevRoom) {
            io.to().emit('UserList', {
                users: getUsersInRoom(prevRoom),

            })
        }

        socket.join(user.room)

        socket.emit('message', buildMsg(ADMIN, buildMsg(`You have joined the ${user.room} chat room`)))

        socket.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has joined the room`))

        io.to(user.room).emit('userList', {
            users: getUsersInRoom(user.room)
        })

        io.emit('roomList', {
            rooms: getAllActiveRooms()
        })
    })


    // Upon connection - to all users

    socket.broadcast.emit('message', `User: ${socket.id.substring(0, 5)} connected`)

    // When user disconnects - to all others
    socket.on('disconnect', () => {
        const user = getUser(socket.id)
        userLeft(socket.id)

        if (user) {
            io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has left the room`))

            io.to(user.room).emit('userList', {
                users: getUsersInRoom(user.room)
            })

            io.emit('roomList', {
                rooms: getAllActiveRooms()
            })
        }

        console.log(`User ${socket.id} disconnected`)
    })

    socket.on('message', ({ name, text }) => {
        const room = getUser(socket.id)?.room
        if (room) {
            io.to(room).emit('message', buildMsg(name, text))
        }
    })

    // Listen for activity
    socket.on('activity', name => {
        const room = getUser(socket.id)

        if (room) {
            socket.broadcast.to(room).emit('activity', name)
        }
    })
})

function buildMsg(name, text) {
    return {
        name,
        text,
        time: new Intl.DateTimeFormat('default', {
            hour: 'numeric',
            minute: 'numeric',
        }).format(new Date())
    }
}

// User functions

function activateUser(name, id, room) {
    const user = { id, name, room }
    usersState.setUsers([...usersState.users.filter(user => user.id !== id), user])

    return user
}

function userLeft(id) {
    usersState.setUsers([...usersState.users.filter(user => user.id !== id)])

}

function getUsersInRoom(room) {
    usersState.setUsers([...usersState.users.filter(user => user.room === room)])
}

function getUser(id) {
    usersState.setUsers([...usersState.users.filter(user => user.id === id)])
}

function getAllActiveRooms() {
    return Array.from(new Set(usersState.users.map(user => user.room)))
}