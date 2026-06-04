const express = require('express')
const app = express()
const PORT = 3000

app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'LKWD backend lever! 🚀' })
})

let cafeData = {
  lunch: {
    description: 'Grillad lax med örtkräm och potatis',
    price: '125:-'
  },
  badges: {
    'Bryggkaffe': { type: 'popular' },
    'Cappuccino': { type: 'bestseller' }
  }
}

app.get('/api/cafe', (req, res) => {
  res.json(cafeData)
})

app.put('/api/cafe/lunch', (req, res) => {
  const { description, price } = req.body

  if (!description || !price) {
    return res.status(400).json({ error: 'description och price krävs' })
  }

  cafeData.lunch = { description, price }
  res.json({ success: true, lunch: cafeData.lunch })
})

app.listen(PORT, () => {
  console.log(`Server körs på http://localhost:${PORT}`)
})