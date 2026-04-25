app.get("/api/stripe-prices", async (req, res) => {
  try {
    const stripePrices = await stripe.prices.list({
      active: true,
      expand: ["data.product"]
    })

    const packages = []

    stripePrices.data.forEach(price => {
      const product = price.product

      // Safety Check
      if (!product || !product.metadata) return
      if (!product.metadata.package_type) return

      packages.push({
        id: product.metadata.package_type,
        name: product.name,
        amount: price.unit_amount || 0,
        coins: Number(product.metadata.coins) || 0,
        stripe_price_id: price.id,
        currency: (price.currency || "eur").toUpperCase()
      })
    })

    // Sort nach Coins (wichtig für UI)
    packages.sort((a, b) => a.coins - b.coins)

    res.json({ packages })

  } catch (error) {
    console.error("Error fetching Stripe prices:", error)
    res.status(500).json({ error: "Failed to fetch prices" })
  }
})