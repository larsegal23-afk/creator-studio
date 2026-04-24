// API Endpoint um Stripe Preise abzurufen
app.get("/api/stripe-prices", async (req, res) => {
  try {
    const stripeProducts = await stripe.products.list({ active: true })
    const stripePrices = await stripe.prices.list({ active: true, expand: ['data.product'] })
    
    const packages = {}
    stripePrices.data.forEach(price => {
      const product = price.product
      if (product.metadata && product.metadata.package_type) {
        packages[product.metadata.package_type] = {
          name: product.name,
          amount: price.unit_amount,
          coins: parseInt(product.metadata.coins || 0),
          stripe_price_id: price.id,
          currency: price.currency.toUpperCase()
        }
      }
    })
    
    res.json({ packages })
  } catch (error) {
    console.error("Error fetching Stripe prices:", error)
    res.status(500).json({ error: "Failed to fetch prices" })
  }
})
