// Synchronous pre-paint boot script for Macisla POS.
// Seeds admin session before Posnic's requirePosnicLogin(), forces premium reports,
// disables marketing popups/nudges, and lands on #/sales/new.
(function () {
  'use strict';

  var FORCED_LOCAL = {
    userplan: 'premium',
    userACLPlan: 'true',
    posnic_desktop_nudge_done: '1',
    posnic_web_ok: '1',
    posnic_demo_nudge_done: '1',
  };

  try {
    document.cookie = 'loginuser=yes; path=/; max-age=31536000; SameSite=Lax';
  } catch (_) {}

  // Prevent any loaded bundle from downgrading plan to 'free' or re-arming marketing veils.
  try {
    if (typeof Storage !== 'undefined' && !Storage.prototype.__macislaGuarded) {
      var origSet = Storage.prototype.setItem;
      var origRemove = Storage.prototype.removeItem;
      Storage.prototype.setItem = function (k, v) {
        if (this === window.localStorage && Object.prototype.hasOwnProperty.call(FORCED_LOCAL, k)) {
          return origSet.call(this, k, FORCED_LOCAL[k]);
        }
        return origSet.call(this, k, v);
      };
      Storage.prototype.removeItem = function (k) {
        if (this === window.localStorage && Object.prototype.hasOwnProperty.call(FORCED_LOCAL, k)) {
          return origSet.call(this, k, FORCED_LOCAL[k]);
        }
        return origRemove.call(this, k);
      };
      Object.defineProperty(Storage.prototype, '__macislaGuarded', { value: true });
    }
  } catch (_) {}

  try {
    var DEFAULT_SEEDS = {
      userid: '665000000000000000000001',
      sid: '665000000000000000000001',
      username: 'admin',
      userfirstname: 'Macisla',
      userlastname: 'Admin',
      userimage: 'user.svg',
      usertype: 'super_admin',
      branch_id_set: '665000000000000000000010',
      branchId: '665000000000000000000010',
      branchname: 'Macisla Main Store',
      branchimage: 'store.png',
      branchemail: 'pos@macisla.com',
      branchaddress: 'Jl. Senopati No. 88, Kebayoran Baru',
      currencySign: 'Rp',
      timezone: 'Asia/Jakarta',
      timeformat: 'enable',
      client_dateformat: 'YYYY-MM-DD',
      server_dateformat: 'YYYY-MM-DD',
      dateformatset: 'YYYY-MM-DD',
      country_setting: 'Indonesia',
      table_options: 'disable',
      tax_type: 'exclusive',
      default_tax_id: '665000000000000000000501',
      print_type: 'thermal',
      printing_max_char: '42',
      printing_size: '80mm',
      userRegisterStatus: 'Open',
      register_id: '665000000000000000000021',
      cash_register_id: '665000000000000000000020',
      register_name: 'Main Counter Register',
      defaultcustomer: JSON.stringify({
        customer_id: '665000000000000000000301',
        customer_name: 'Walk-in Customer',
        customer_phone: '0000000000',
        customer_email: 'walkin@macisla.com',
        customer_address: 'Jakarta',
      }),
      defaultsupplier: JSON.stringify({
        supplier_id: '665000000000000000000401',
        supplier_name: 'Macisla Supply Co.',
        supplier_phone: '+62 21-555-0199',
      }),
      general_settings: JSON.stringify({
        module_tax_enable: true,
        module_online_ordering_enable: false,
        hardware_weight_machine_enable: false,
      }),
      outstandingModalShown: 'true',
    };

    for (var key in DEFAULT_SEEDS) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_SEEDS, key)) continue;
      var cur = localStorage.getItem(key);
      if (!cur || !String(cur).trim() || cur === 'null' || cur === 'undefined') {
        localStorage.setItem(key, DEFAULT_SEEDS[key]);
      }
    }
    if (localStorage.getItem('language') == null) localStorage.setItem('language', '');
    for (var fk in FORCED_LOCAL) {
      if (Object.prototype.hasOwnProperty.call(FORCED_LOCAL, fk)) {
        localStorage.setItem(fk, FORCED_LOCAL[fk]);
      }
    }
  } catch (_) {}

  window.ensureAutoPosnicLogin = window.ensureAutoPosnicLogin || function () {};

  try {
    var p = location.pathname;
    if (p === '/dashboard' || p === '/dashboard.html') {
      var h = location.hash;
      if (!h || h === '#' || h === '#/' || h === '#/login') {
        history.replaceState(null, '', p + location.search + '#/sales/new');
      }
    }
  } catch (_) {}

  try {
    if (!document.getElementById('macisla-no-marketing')) {
      var style = document.createElement('style');
      style.id = 'macisla-no-marketing';
      style.textContent =
        '#posnic_desktop_nudge,#posnic_demo_bar,#posnic_demo_nudge,#posnic_app_card,' +
        '[id$="_upgrade"],[id$="_upgrade_btn"]{display:none !important;}';
      (document.head || document.documentElement).appendChild(style);
    }
  } catch (_) {}
})();
