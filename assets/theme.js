(() => {
  const qs = (sel, root = document) => (root || document).querySelector(sel);
  const qsa = (sel, root = document) => [...(root || document).querySelectorAll(sel)];

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
  const keepShopping = qs('[data-keep-shopping]');

  const setKeepShopping = (url) => {
    if (!keepShopping || !url) return;
    keepShopping.href = url;
    keepShopping.hidden = false;
  };

  const openDrawer = () => {
    if (!drawer) return;
    drawer.classList.add('is-open');
    document.body.classList.add('cart-open');
  };
  const closeDrawer = () => {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    document.body.classList.remove('cart-open');
  };

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
    const selected = findVariant(form, selectedOptionValues(form));
    if (selected) {
      const select = qs('[data-variant-select]', form);
      if (select) select.value = String(selected.id);
    }
    const athleteStore = form.dataset.athleteStore || qs('[data-athlete-store]', form)?.getAttribute('data-athlete-store');
    if (athleteStore) setKeepShopping(athleteStore);
    const data = new FormData(form);
    const res = await fetch('/cart/add.js', { method: 'POST', body: data });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.description || 'Unable to add to cart.');
      return;
    }
    await refreshCart();
    openDrawer();
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

  const mobileDrawer = qs('[data-mobile-drawer]');
  const searchModal = qs('[data-search-modal]');
  let uiOpenedAt = 0;

  const setMenuOpen = (open) => {
    mobileDrawer?.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
  };
  const syncSearchViewport = () => {
    if (!searchModal?.classList.contains('is-open')) return;
    const vv = window.visualViewport;
    const height = vv?.height || window.innerHeight;
    const offset = vv?.offsetTop || 0;
    searchModal.style.height = `${Math.round(height)}px`;
    searchModal.style.top = `${Math.round(offset)}px`;
  };

  const setSearchOpen = (open) => {
    searchModal?.classList.toggle('is-open', open);
    document.body.classList.toggle('search-open', open);
    if (open) {
      syncSearchViewport();
      window.setTimeout(() => searchModal?.querySelector('input')?.focus(), 20);
    } else if (searchModal) {
      searchModal.style.height = '';
      searchModal.style.top = '';
    }
  };

  const applyVariantImage = (image, alt) => {
    const main = qs('[data-product-main]');
    if (main && image) {
      main.src = image;
      if (alt) main.alt = alt;
    }
  };

  const productJsonFrom = (form) => {
    const node = qs('[data-product-json]', form);
    if (!node) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (err) {
      return null;
    }
  };

  const selectedOptionValues = (form, clicked) => {
    const byPos = {};
    qsa('[data-swatch]', form).forEach((input) => {
      const pos = input.getAttribute('data-option-position');
      if (!pos) return;
      if (input.checked) byPos[pos] = input.value;
    });
    if (clicked) {
      const pos = clicked.getAttribute('data-option-position');
      if (pos) byPos[pos] = clicked.value;
    }
    return byPos;
  };

  const findVariant = (form, byPos) => {
    const product = productJsonFrom(form);
    const variants = product?.variants || [];
    if (variants.length) {
      return variants.find((variant) =>
        Object.entries(byPos).every(([pos, val]) => (variant[`option${pos}`] || '') === val)
      ) || null;
    }
    const select = qs('[data-variant-select]', form);
    if (!select) return null;
    const option = [...select.options].find((opt) =>
      Object.entries(byPos).every(([pos, val]) => (opt.dataset[`option${pos}`] || '') === val)
    );
    if (!option) return null;
    return {
      id: option.value,
      available: option.dataset.available === 'true',
      price: option.dataset.price,
      title: option.textContent.split(' — ')[0],
      featured_image: option.dataset.image || '',
    };
  };

  const applySelectedVariant = (form, variant) => {
    if (!form || !variant) return;
    const select = qs('[data-variant-select]', form);
    if (select && String(select.value) !== String(variant.id)) {
      select.value = String(variant.id);
    }
    if (select) {
      const option = [...select.options].find((opt) => String(opt.value) === String(variant.id));
      const url = new URL(window.location.href);
      url.searchParams.set('variant', String(variant.id));
      window.history.replaceState({}, '', url);
      const priceEl = qs('[data-product-price]');
      if (priceEl && (variant.price || option?.dataset.price)) {
        priceEl.innerHTML = variant.price || option.dataset.price;
      }
      const btn = qs('[data-add-btn]', form);
      if (btn) {
        const available = variant.available !== undefined ? !!variant.available : option?.dataset.available === 'true';
        btn.disabled = !available;
        btn.textContent = available ? 'Add to cart' : 'Sold out';
      }
      if (option && variant.featured_image && !option.dataset.image) {
        option.dataset.image = variant.featured_image;
      }
    }
    applyVariantImage(variant.featured_image, variant.title);
    const label = qs('[data-selected-variant]', form);
    if (label && variant.title) label.textContent = variant.title;
  };

  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open-cart]');
    const closeBtn = e.target.closest('[data-close-cart]');
    const qtyBtn = e.target.closest('[data-qty-change]');
    const menuBtn = e.target.closest('[data-menu-toggle]');
    const searchOpen = e.target.closest('[data-open-search]');
    const searchClose = e.target.closest('[data-close-search]');
    const thumb = e.target.closest('[data-product-thumb]');
    const drawerLink = e.target.closest('[data-mobile-drawer] a');

    if (openBtn) {
      e.preventDefault();
      refreshCart().then(openDrawer);
    }
    if (closeBtn || e.target.matches('[data-cart-drawer-overlay]')) closeDrawer();
    if (qtyBtn) updateQty(qtyBtn.dataset.qtyChange, Number(qtyBtn.dataset.qty));
    if (menuBtn) {
      e.preventDefault();
      e.stopPropagation();
      uiOpenedAt = Date.now();
      setMenuOpen(!mobileDrawer?.classList.contains('is-open'));
    }
    if (drawerLink) {
      setMenuOpen(false);
    }
    if (searchOpen) {
      e.preventDefault();
      e.stopPropagation();
      uiOpenedAt = Date.now();
      setSearchOpen(true);
    }
    if (searchClose || e.target === searchModal) {
      if (Date.now() - uiOpenedAt < 800) return;
      if (e.target === searchModal || searchClose) setSearchOpen(false);
    }
    if (thumb) applyVariantImage(thumb.dataset.productThumb);
  });

  qsa('[data-product-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      addToCart(form);
    });
  });

  qsa('[data-variant-select]').forEach((select) => {
    select.addEventListener('change', () => {
      const form = select.closest('form') || select.closest('[data-product-form]') || document;
      const product = productJsonFrom(form);
      const variant =
        product?.variants?.find((item) => String(item.id) === String(select.value)) || {
          id: select.value,
          available: select.options[select.selectedIndex]?.dataset.available === 'true',
          price: select.options[select.selectedIndex]?.dataset.price,
          title: select.options[select.selectedIndex]?.textContent.split(' — ')[0],
          featured_image: select.options[select.selectedIndex]?.dataset.image || '',
        };
      applySelectedVariant(form, variant);
    });
  });

  const selectVariantFromSwatches = (input) => {
    const form = input.closest('form');
    if (!form) return;
    const byPos = selectedOptionValues(form, input);
    const variant = findVariant(form, byPos);
    if (variant) {
      applySelectedVariant(form, variant);
      return;
    }
    applyVariantImage(input.dataset.image);
  };

  qsa('[data-swatch]').forEach((input) => {
    const pick = () => selectVariantFromSwatches(input);
    input.addEventListener('change', pick);
    input.closest('label')?.addEventListener('click', () => {
      window.requestAnimationFrame(pick);
    });
  });

  document.addEventListener('click', (e) => {
    const thumb = e.target.closest('[data-product-thumb]');
    if (!thumb || !thumb.dataset.thumbOption1) return;
    const form = qs('[data-product-form]');
    if (!form) return;
    const color = thumb.dataset.thumbOption1;
    const colorInput = qsa('[data-swatch][data-option-position="1"]', form).find((input) => input.value === color);
    if (!colorInput) return;
    colorInput.checked = true;
    selectVariantFromSwatches(colorInput);
  });

  const productForm = qs('[data-product-form]');
  const athleteStore = productForm
    ? productForm.dataset.athleteStore || qs('[data-athlete-store]', productForm)?.getAttribute('data-athlete-store')
    : null;
  if (athleteStore) setKeepShopping(athleteStore);

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

  const noResults = qs('[data-no-results]');
  const storeCount = qs('[data-store-count]');
  let activeFilter = 'all';

  const nameMatchesQuery = (name, query) => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return true;
    const t = (name || '').toLowerCase();
    if (t.startsWith(q) || t.includes(q)) return true;
    return t.split(/[\s'_-]+/).some((word) => word.startsWith(q));
  };

  const filterAthletes = (input = qs('#athlete-search')) => {
    const query = (input?.value || '').trim().toLowerCase();
    const athleteCards = qsa('[data-athlete-grid] .athlete-card');
    let visible = 0;
    athleteCards.forEach((card) => {
      const name = card.dataset.name || '';
      const sport = card.dataset.sport || '';
      const matchQuery = nameMatchesQuery(name, query) || (!!query && sport.includes(query));
      const matchFilter = activeFilter === 'all' || sport === activeFilter;
      const show = matchQuery && matchFilter;
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (storeCount) storeCount.textContent = `${visible} store${visible === 1 ? '' : 's'}`;
    if (noResults) noResults.classList.toggle('is-visible', visible === 0 && athleteCards.length > 0);
  };

  qsa('[data-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      qsa('[data-filter]').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      activeFilter = chip.dataset.filter || 'all';
      filterAthletes();
    });
  });
  if (qs('#athlete-search')) filterAthletes();

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
    setMenuOpen(false);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
    history.replaceState(null, '', `#${id}`);
    setActiveNav(id);
  });

  const athleteSearch = qs('[data-athlete-search]');
  const athleteResults = qs('[data-athlete-results]');
  const athleteIndexNode = qs('[data-athlete-index]');
  let athleteIndex = [];
  if (athleteIndexNode) {
    try {
      athleteIndex = JSON.parse(athleteIndexNode.textContent || '[]');
    } catch (err) {
      athleteIndex = [];
    }
  }

  const ensureAthleteIndex = async () => {
    if (athleteIndex.length) return;
    try {
      const res = await fetch('/collections.json?limit=250');
      if (!res.ok) return;
      const data = await res.json();
      athleteIndex = (data.collections || [])
        .filter((item) => item.handle && item.handle !== 'all' && item.handle !== 'frontpage')
        .map((item) => ({
          title: item.title,
          url: `/collections/${item.handle}`,
          image: (item.image && item.image.src) || '',
        }));
    } catch (err) {}
  };

  const athleteMatches = (item, query) => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    const t = String(item.title || '').toLowerCase();
    const url = String(item.url || '').toLowerCase().replace(/-/g, ' ');
    if (t.startsWith(q) || t.includes(q) || url.includes(q)) return true;
    return t.split(/[\s'_-]+/).some((word) => word.startsWith(q));
  };

  const escapeHtml = (value) =>
    String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));

  const renderAthleteResults = (query) => {
    const results = qs('[data-athlete-results]');
    if (!results) return;
    const q = (query || '').trim();
    if (!q) {
      results.innerHTML = '';
      return;
    }
    const hits = athleteIndex.filter((item) => athleteMatches(item, q)).slice(0, 12);
    if (!hits.length) {
      results.innerHTML = `<p class="athlete-search-empty">No athletes found for “${escapeHtml(q)}”.</p>`;
      return;
    }
    results.innerHTML = hits
      .map((item) => {
        const src = String(item.image || '').replace(/^\/\//, 'https://');
        const img = src
          ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.title)}" width="48" height="48" loading="lazy" decoding="async">`
          : '';
        return `<a class="athlete-search-hit" href="${escapeHtml(item.url)}">${img}<span>${escapeHtml(item.title)}</span></a>`;
      })
      .join('');
  };

  let searchTimer = 0;
  const queueAthleteResults = (value) => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(async () => {
      await ensureAthleteIndex();
      renderAthleteResults(value);
    }, 40);
  };

  document.addEventListener('input', (e) => {
    if (e.target.matches('[data-athlete-search]')) queueAthleteResults(e.target.value);
    if (e.target.matches('#athlete-search') || e.target.closest('[data-athlete-filter-form]')) {
      filterAthletes(e.target);
    }
  });
  document.addEventListener('search', (e) => {
    if (e.target.matches('[data-athlete-search]')) renderAthleteResults(e.target.value);
    if (e.target.matches('#athlete-search')) filterAthletes(e.target);
  }, true);
  document.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-athlete-search-form], [data-athlete-filter-form]')) return;
    e.preventDefault();
    const modalInput = qs('[data-athlete-search]', e.target);
    const pageInput = qs('#athlete-search', e.target) || qs('#athlete-search');
    if (modalInput) renderAthleteResults(modalInput.value);
    if (pageInput) filterAthletes(pageInput);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setSearchOpen(false);
  });
  window.visualViewport?.addEventListener('resize', syncSearchViewport);
  window.visualViewport?.addEventListener('scroll', syncSearchViewport);
  if (athleteSearch?.value) renderAthleteResults(athleteSearch.value);

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
