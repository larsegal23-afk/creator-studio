// API Endpoint um eine Stripe Checkout Session zu erstellen
// POST /api/create-checkout-session
// Body: { pack: "starter" | "pro" | "ultimate" }
// Response: { url: string, sessionId: string }
app.post("/api/create-checkout-session", requireAuth, async (req, res) => {
  try {
    // Stripe muss initialisiert sein
    if (!stripe) {
      console.error("Stripe not initialized - STRIPE_SECRET_KEY missing")
      return res.status(500).json({ error: "Payment service not configured. Please contact support." })
    }

    const { pack } = req.body
    const uid = req.user.uid

    // Paket-Konfiguration – Keys müssen mit dem Frontend übereinstimmen (starter, pro, ultimate)
    const packages = {
      starter: {
        name: "Starter (120 Coins)",
        coins: 120,
        price: 499, // 4,99 € in Cent
        priceId: process.env.STRIPE_PRICE_STARTER || null
      },
      pro: {
        name: "Professional (700 Coins)",
        coins: 700,
        price: 1999, // 19,99 € in Cent
        priceId: process.env.STRIPE_PRICE_PRO || null
      },
      ultimate: {
        name: "Enterprise (2000 Coins)",
        coins: 2000,
        price: 4999, // 49,99 € in Cent
        priceId: process.env.STRIPE_PRICE_ULTIMATE || null
      }
    }

    const selectedPackage = packages[pack]
    if (!selectedPackage) {
      return res.status(400).json({ error: `Invalid package type: "${pack}". Valid values: starter, pro, ultimate` })
    }

    // Wenn eine vorkonfigurierte Price ID vorhanden ist, diese verwenden – sonst inline price_data
    const lineItem = selectedPackage.priceId
      ? { price: selectedPackage.priceId, quantity: 1 }
      : {
          price_data: {
            currency: "eur",
            product_data: {
              name: selectedPackage.name,
              description: `${selectedPackage.coins} Coins für Creator Studio`
            },
            unit_amount: selectedPackage.price
          },
          quantity: 1
        }

    // Stripe Checkout Session erstellen
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [lineItem],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL || "https://logomakergermany-kreativtool.web.app"}/success?session_id={CHECKOUT_SESSION_ID}&pack=${pack}&coins=${selectedPackage.coins}`,
      cancel_url: `${process.env.FRONTEND_URL || "https://logomakergermany-kreativtool.web.app"}/cancel`,
      client_reference_id: uid,
      metadata: {
        userId: uid,
        package: pack,
        coins: selectedPackage.coins.toString()
      }
    })

    res.json({ sessionId: session.id, url: session.url })

  } catch (error) {
    console.error("Create checkout session error:", error.message)
    console.error("Full error:", error)
    res.status(500).json({
      error: "Failed to create checkout session",
      details: error.message
    })
  }
})
