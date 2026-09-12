(() => {
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

  const formatMoney = (cents) => {
    const format = (window.theme && window.theme.moneyFormat) || '${{amount}}';
    const amount = (cents / 100).toFixed(2);
    return format
      .replace(/\{\{\s*amount\s*\}\}/g, amount)
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, String(Math.round(cents / 100)));
  };

  const cartCountEls = qsa('[data-cart-count]');
  const setCartCount = (count) => {
    cartCountEls.forEach((el) => {
      el.textContent = count;
      el.hidden = count < 1;
    });
  };

  const drawer = qs('[data-cart-drawer]');
  const drawerBody = qs('[data-cart-drawer-body]');
  const drawerSubtotal = qs('[data-cart-subtotal]');
  const shippingNote = qs('[data-shipping-note]');

  const openDrawer = () => drawer && drawer.classList.add('is-open');
  const closeDrawer = () => drawer && drawer.classList.remove('is-open');

  const renderDrawer = (cart) => {
    if (!drawerBody) return;
    setCartCount(cart.item_count);
    if (drawerSubtotal) drawerSubtotal.textContent = formatMoney(cart.total_price);
    if (shippingNote && window.theme) {
      const threshold = Number(window.theme.freeShipping || 150) * 100;
      if (cart.total_price >= threshold) {
        shippingNote.textContent = 'You qualify for free shipping.';
      } else {
        shippingNote.textContent = `Add ${formatMoney(threshold - cart.total_price)} more for free shipping.`;
      }
    }
    if (!cart.items.length) {
      drawerBody.innerHTML = '<div class="empty-state"><p>Your cart is empty</p></div>';
      return;
    }
    drawerBody.innerHTML = cart.items
      .map(
        (item) => `
        <div class="cart-item">
          <a class="cart-item-media" href="${item.url || '#'}"><img src="${item.image || ''}" alt="${item.title}"></a>
          <div>
            <strong>${item.product_title}</strong>
            <p class="price">${item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title + ' · ' : ''}${formatMoney(item.final_line_price)}</p>
            <div class="qty">
              <button type="button" data-qty-change="${item.key}" data-qty="${item.quantity - 1}">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-qty-change="${item.key}" data-qty="${item.quantity + 1}">+</button>
            </div>
          </div>
          <button type="button" data-qty-change="${item.key}" data-qty="0" aria-label="Remove">✕</button>
        </div>`
      )
      .join('');
  };

  const refreshCart = async () => {
    const cart = await fetch('/cart.js').then((r) => r.json());
    renderDrawer(cart);
    return cart;
  };

  const addToCart = async (form) => {
    const data = new FormData(form);
    const res = await fetch('/cart/add.js', { method: 'POST', body: data });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.description || 'Unable to add to cart.');
      return;
    }
    await refreshCart();
    if (window.theme && window.theme.cartDrawer) openDrawer();
    else window.location.href = '/cart';
  };

  const updateQty = async (key, quantity) => {
    await fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity }),
    });
    const cart = await refreshCart();
    if (qs('.template-cart')) window.location.reload();
    return cart;
  };

  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open-cart]');
    const closeBtn = e.target.closest('[data-close-cart]');
    const qtyBtn = e.target.closest('[data-qty-change]');
    const menuBtn = e.target.closest('[data-menu-toggle]');
    const searchOpen = e.target.closest('[data-open-search]');
    const searchClose = e.target.closest('[data-close-search]');
    const thumb = e.target.closest('[data-product-thumb]');

    if (openBtn) {
      e.preventDefault();
      refreshCart().then(openDrawer);
    }
    if (closeBtn || e.target.matches('[data-cart-drawer-overlay]')) closeDrawer();
    if (qtyBtn) updateQty(qtyBtn.dataset.qtyChange, Number(qtyBtn.dataset.qty));
    if (menuBtn) qs('[data-mobile-drawer]')?.classList.toggle('is-open');
    if (searchOpen) {
      e.preventDefault();
      qs('[data-search-modal]')?.classList.add('is-open');
      qs('[data-search-modal] input')?.focus();
    }
    if (searchClose || e.target.matches('[data-search-modal]')) {
      if (e.target.matches('[data-search-modal]') || searchClose) {
        qs('[data-search-modal]')?.classList.remove('is-open');
      }
    }
    if (thumb) {
      const main = qs('[data-product-main]');
      if (main) main.src = thumb.dataset.productThumb;
    }
  });

  qsa('[data-product-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      addToCart(form);
    });
  });

  qsa('[data-variant-select]').forEach((select) => {
    select.addEventListener('change', () => {
      const id = select.value;
      const option = select.options[select.selectedIndex];
      const url = new URL(window.location.href);
      url.searchParams.set('variant', id);
      window.history.replaceState({}, '', url);
      const priceEl = qs('[data-product-price]');
      if (priceEl && option.dataset.price) priceEl.innerHTML = option.dataset.price;
      const btn = qs('[data-add-btn]');
      if (btn) {
        const available = option.dataset.available === 'true';
        btn.disabled = !available;
        btn.textContent = available ? 'Add to cart' : 'Sold out';
      }
    });
  });

  qsa('[data-swatch]').forEach((input) => {
    input.addEventListener('change', () => {
      const form = input.closest('form');
      const selects = qsa('[data-option-position]', form);
      const values = selects.map((sel) => {
        if (sel === input) return input.value;
        const checked = qs(`input[name="${sel.name}"]:checked`, form);
        return checked ? checked.value : sel.value;
      });
      const variantSelect = qs('[data-variant-select]', form);
      if (!variantSelect) return;
      [...variantSelect.options].forEach((opt) => {
        const match = values.every((val, i) => (opt.dataset[`option${i + 1}`] || '') === val);
        if (match) {
          variantSelect.value = opt.value;
          variantSelect.dispatchEvent(new Event('change'));
        }
      });
    });
  });

  refreshCart().catch(() => {});

  /* Scroll reveal — fast, minimal delay */
  const revealEls = qsa('.reveal, .reveal-stagger');
  if (revealEls.length && 'IntersectionObserver' in window) {
    const revealObs = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObs.unobserve(entry.target);
        }
      }),
      { threshold: 0.01, rootMargin: '0px 0px 40px 0px' }
    );
    revealEls.forEach((el) => revealObs.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  qsa('.orbit-card').forEach((card) => {
    card.addEventListener('click', () => {
      if (window.matchMedia('(hover: none)').matches) {
        const open = card.classList.toggle('is-open');
        if (open) {
          qsa('.orbit-card.is-open').forEach((other) => {
            if (other !== card) other.classList.remove('is-open');
          });
        }
      }
    });
  });

  const marquee = qs('[data-reviews-marquee]');
  if (marquee && 'IntersectionObserver' in window) {
    const marqueeObs = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        marquee.classList.toggle('is-paused', !entry.isIntersecting);
      }),
      { threshold: 0.05 }
    );
    marqueeObs.observe(marquee);
  }

  const searchInput = qs('#athlete-search');
  const athleteCards = qsa('[data-athlete-grid] .athlete-card');
  const noResults = qs('[data-no-results]');
  const storeCount = qs('[data-store-count]');
  let activeFilter = 'all';

  const filterAthletes = () => {
    const query = (searchInput?.value || '').trim().toLowerCase();
    let visible = 0;
    athleteCards.forEach((card) => {
      const name = card.dataset.name || '';
      const sport = card.dataset.sport || '';
      const matchQuery = !query || name.includes(query) || sport.includes(query);
      const matchFilter = activeFilter === 'all' || sport === activeFilter;
      const show = matchQuery && matchFilter;
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (storeCount) storeCount.textContent = `${visible} store${visible === 1 ? '' : 's'}`;
    if (noResults) noResults.classList.toggle('is-visible', visible === 0);
  };

  searchInput?.addEventListener('input', filterAthletes);
  qsa('[data-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      qsa('[data-filter]').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      activeFilter = chip.dataset.filter || 'all';
      filterAthletes();
    });
  });

  const sections = qsa('section[id]');
  const navLinks = qsa('[data-scroll-nav] a[href*="#"]');
  const setActiveNav = (id) => {
    navLinks.forEach((link) => {
      const href = link.getAttribute('href') || '';
      link.classList.toggle('is-active', href === `#${id}` || href.endsWith(`#${id}`));
    });
  };

  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href*="#"]');
    if (!anchor || anchor.target === '_blank') return;
    const href = anchor.getAttribute('href') || '';
    const id = href.split('#')[1];
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    qs('[data-mobile-drawer]')?.classList.remove('is-open');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
    setActiveNav(id);
  });

  if (sections.length && 'IntersectionObserver' in window) {
    const navObs = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) setActiveNav(entry.target.id);
      }),
      { threshold: 0.35, rootMargin: '-20% 0px -55% 0px' }
    );
    sections.forEach((sec) => navObs.observe(sec));
  }
})();
