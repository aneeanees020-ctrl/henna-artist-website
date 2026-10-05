/* =========================================================
   HENNA ARTIST — ADMIN PANEL SCRIPT
========================================================= */


/* =========================================================
   ADMIN SECURITY
========================================================= */

const SECURITY_API =
  "https://script.google.com/macros/s/AKfycbwxEsN1g05d8Vn2OZv3LO_FYDN8z6CRlE23Sy4r_as4TDhNLQZF1kwlYhIEyxLKxqDo8Q/exec";

let adminSessionToken =
  localStorage.getItem("henna_admin_session") || "";


/* =========================================================
   SECURITY REQUEST
   JSONP + RETRY
========================================================= */

function securityRequest(params) {

  return new Promise(function(resolve, reject) {

    let attempts = 0;
    const maxAttempts = 3;

    function tryRequest() {

      attempts++;

      const callbackName =
        "hennaSecurityCallback_" +
        Date.now() +
        "_" +
        attempts;

      const script =
        document.createElement("script");

      const query =
        Object.keys(params)
          .map(function(key) {

            return (
              encodeURIComponent(key) +
              "=" +
              encodeURIComponent(params[key])
            );

          })
          .join("&");

      let completed = false;

      window[callbackName] = function(data) {

        if (completed) return;

        completed = true;

        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }

        delete window[callbackName];

        resolve(data);
      };


      script.onerror = function() {

        if (completed) return;

        if (attempts < maxAttempts) {

          console.log(
            "Security API request failed. Retrying:",
            attempts
          );

          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }

          setTimeout(
            tryRequest,
            2000
          );

        } else {

          completed = true;

          delete window[callbackName];

          reject(
            new Error(
              "Security API request failed after retries."
            )
          );
        }
      };


      script.src =
        SECURITY_API +
        "?" +
        query +
        "&callback=" +
        encodeURIComponent(callbackName) +
        "&_=" +
        Date.now();


      document.body.appendChild(script);


      /*
        Give Google Apps Script enough time.
        Do NOT delete the callback while waiting.
      */

      setTimeout(function() {

        if (completed) return;

        if (attempts < maxAttempts) {

          console.log(
            "Security API slow. Retrying:",
            attempts
          );

          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }

          /*
            Keep the callback alive so a late
            Google response can still be received.
          */

          setTimeout(
            tryRequest,
            2000
          );

        } else {

          completed = true;

          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }

          delete window[callbackName];

          reject(
            new Error(
              "Security API request timed out."
            )
          );
        }

      }, 15000);

    }

    tryRequest();

  });
}
/* =========================================================
   SHA-256
========================================================= */

async function sha256Browser(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const hash = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return Array.from(new Uint8Array(hash))
    .map(function (byte) {
      return byte
        .toString(16)
        .padStart(2, "0");
    })
    .join("");
}


/* =========================================================
   SHOW LOGIN
========================================================= */

function showAdminLogin() {
  const login =
    document.getElementById("adminLogin");

  const dashboard =
    document.getElementById("adminDashboard");

  if (login) {
    login.hidden = false;
  }

  if (dashboard) {
    dashboard.hidden = true;
  }
}


/* =========================================================
   SHOW DASHBOARD
========================================================= */

function showAdminDashboard() {
  const login =
    document.getElementById("adminLogin");

  const dashboard =
    document.getElementById("adminDashboard");

  if (login) {
    login.hidden = true;
  }

  if (dashboard) {
    dashboard.hidden = false;
  }

  loadBookings();
  loadGallery();
}


/* =========================================================
   LOGIN
========================================================= */

async function adminLogin() {
  const usernameInput =
    document.getElementById("adminUsername");

  const passwordInput =
    document.getElementById("adminPassword");

  const loginButton =
    document.getElementById("loginButton");

  const errorBox =
    document.getElementById("loginError");

  const username =
    usernameInput
      ? usernameInput.value.trim()
      : "";

  const password =
    passwordInput
      ? passwordInput.value
      : "";

  if (!username || !password) {
    if (errorBox) {
      errorBox.textContent =
        "Please enter username and password.";
    }

    return;
  }

  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";
  }

  if (errorBox) {
    errorBox.textContent = "";
  }

  try {
    /* GET CHALLENGE */

    const challenge =
      await securityRequest({
        action: "challenge"
      });

    if (
      !challenge ||
      !challenge.success ||
      !challenge.nonce
    ) {
      throw new Error(
        "Could not create login request."
      );
    }

    /* CREATE PROOF */

    const proof =
      await sha256Browser(
        password +
        ":" +
        challenge.nonce
      );

    /* LOGIN */

    const result =
      await securityRequest({
        action: "login",
        username: username,
        nonce: challenge.nonce,
        proof: proof
      });

    if (
      !result ||
      !result.success ||
      !result.token
    ) {
      throw new Error(
        result && result.error
          ? result.error
          : "Invalid username or password."
      );
    }

    /* SAVE SESSION */

    adminSessionToken = result.token;

    localStorage.setItem(
      "henna_admin_session",
      adminSessionToken
    );

    /* CLEAR PASSWORD */

    if (passwordInput) {
      passwordInput.value = "";
    }

    /* OPEN DASHBOARD */

    showAdminDashboard();

  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    if (errorBox) {
      errorBox.textContent =
        error.message ||
        "Login failed.";
    }

  } finally {
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = "Sign In";
    }
  }
}


/* =========================================================
   CHECK SESSION
========================================================= */

async function checkAdminSession() {
  if (!adminSessionToken) {
    showAdminLogin();
    return;
  }

  try {
    const result =
      await securityRequest({
        action: "check",
        token: adminSessionToken
      });

    if (
      result &&
      result.success
    ) {
      showAdminDashboard();

    } else {
      adminSessionToken = "";

      localStorage.removeItem(
        "henna_admin_session"
      );

      showAdminLogin();
    }

  } catch (error) {
    console.error(
      "SESSION CHECK ERROR:",
      error
    );

    adminSessionToken = "";

    localStorage.removeItem(
      "henna_admin_session"
    );

    showAdminLogin();
  }
}


/* =========================================================
   LOGOUT
========================================================= */

async function adminLogout() {
  const token =
    adminSessionToken;

  adminSessionToken = "";

  localStorage.removeItem(
    "henna_admin_session"
  );

  try {
    if (token) {
      await securityRequest({
        action: "logout",
        token: token
      });
    }

  } catch (error) {
    console.error(
      "LOGOUT ERROR:",
      error
    );
  }

  showAdminLogin();
}


/* =========================================================
   API URLS
========================================================= */

const BOOKING_API =
  "https://script.google.com/macros/s/AKfycbzj4Xph2X64VMXQLqKSOPhPp2s54VT-hZ44dBh81Q29GBt41t060QKf8CAb4LMblju-qA/exec";

const GALLERY_API =
  "https://script.google.com/macros/s/AKfycbyIw3aAGTmvpQ0ycwgLxBUU0ytSNQz4vDY_6y_W6AeWfUI7GjhQpLydiFyip5F87HR_3w/exec";


/* =========================================================
   BOOKING VARIABLES
========================================================= */

let allBookingsData = [];
let showAllBookings = false;


/* =========================================================
   LOAD BOOKINGS
========================================================= */

function loadBookings() {
  const bookingTable =
    document.querySelector(".booking-table");

  if (!bookingTable) {
    return;
  }

  const callbackName =
    "bookingCallback_" + Date.now();

  window[callbackName] = function (bookings) {
    allBookingsData =
      Array.isArray(bookings)
        ? bookings.filter(function (booking) {
            return (
              booking &&
              booking.name &&
              booking.name !== "Name"
            );
          })
        : [];

    renderBookings();

    const script =
      document.getElementById(callbackName);

    if (script) {
      script.remove();
    }

    delete window[callbackName];
  };

  const script =
    document.createElement("script");

  script.id = callbackName;

  script.src =
    BOOKING_API +
    "?action=bookings&callback=" +
    encodeURIComponent(callbackName);

  script.onerror = function () {
    bookingTable.innerHTML =
      '<div class="table-head">' +
        "<span>Name</span>" +
        "<span>Phone</span>" +
        "<span>Date</span>" +
        "<span>Event Type</span>" +
        "<span>People</span>" +
        "<span>Location</span>" +
        "<span>Design Preference</span>" +
        "<span>Status</span>" +
      "</div>" +

      '<div class="booking-row">' +
        "<span>Could not load bookings.</span>" +
        "<span>-</span>" +
        "<span>-</span>" +
        "<span>-</span>" +
        "<span>-</span>" +
        "<span>-</span>" +
        "<span>-</span>" +
        "<span>-</span>" +
      "</div>";

    delete window[callbackName];

    script.remove();
  };

  document.body.appendChild(script);
}


/* =========================================================
   RENDER BOOKINGS
========================================================= */

function renderBookings() {
  const bookingTable =
    document.querySelector(".booking-table");

  if (!bookingTable) {
    return;
  }

  /* SEARCH */

  const searchInput =
    document.getElementById(
      "bookingSearch"
    );

  const searchText =
    searchInput
      ? searchInput.value.trim().toLowerCase()
      : "";

  /* STATUS FILTER */

  const statusFilter =
    document.getElementById(
      "bookingStatusFilter"
    );

  const selectedStatus =
    statusFilter
      ? statusFilter.value.toLowerCase()
      : "all";

  /* FILTER BOOKINGS */

  const filteredBookings =
    allBookingsData.filter(function (booking) {
      const name =
        String(
          booking.name || ""
        ).toLowerCase();

      const phone =
        String(
          booking.phone || ""
        ).toLowerCase();

      const status =
        String(
          booking.status || "Pending"
        ).toLowerCase();

      const matchesSearch =
        !searchText ||
        name.indexOf(searchText) !== -1 ||
        phone.indexOf(searchText) !== -1;

      const matchesStatus =
        selectedStatus === "all" ||
        status === selectedStatus;

      return (
        matchesSearch &&
        matchesStatus
      );
    });

  /* SHOW 5 OR ALL */

  const bookingsToShow =
    showAllBookings
      ? filteredBookings
      : filteredBookings.slice(0, 5);

  /* TABLE HEADER */

  bookingTable.innerHTML =
    '<div class="table-head">' +
      "<span>Name</span>" +
      "<span>Phone</span>" +
      "<span>Date</span>" +
      "<span>Event Type</span>" +
      "<span>People</span>" +
      "<span>Location</span>" +
      "<span>Design Preference</span>" +
      "<span>Status</span>" +
    "</div>";

  /* NO RESULTS */

  if (bookingsToShow.length === 0) {
    bookingTable.innerHTML +=
      '<div class="booking-row">' +
        "<span>No bookings found.</span>" +
        "<span>-</span>" +
        "<span>-</span>" +
        "<span>-</span>" +
        "<span>-</span>" +
        "<span>-</span>" +
        "<span>-</span>" +
        "<span>-</span>" +
      "</div>";
  }

  /* SHOW BOOKINGS */

  bookingsToShow.forEach(function (booking) {
    const row =
      document.createElement("div");

    row.className = "booking-row";

    const status =
      booking.status || "Pending";

    const statusClass =
      status.toLowerCase() === "confirmed"
        ? "confirmed"
        : "pending";

    let html = "";

    /* NAME */

    html +=
      "<span>" +
      escapeHtml(
        booking.name || "-"
      ) +
      "</span>";

    /* PHONE */

    html +=
      "<span>" +
      escapeHtml(
        booking.phone || "-"
      ) +
      "</span>";

    /* DATE */

    html +=
      "<span>" +
      escapeHtml(
        formatDate(booking.date)
      ) +
      "</span>";

    /* EVENT TYPE */

    html +=
      "<span>" +
      escapeHtml(
        booking.event || "-"
      ) +
      "</span>";

    /* PEOPLE */

    html +=
      "<span>" +
      escapeHtml(
        booking.people || "-"
      ) +
      "</span>";

    /* LOCATION */

    html +=
      "<span>" +
      escapeHtml(
        booking.location || "-"
      ) +
      "</span>";

    /* DESIGN PREFERENCE */

    html +=
      "<span>" +
      escapeHtml(
        booking.design || "-"
      ) +
      "</span>";

    /* STATUS */

    html +=
      '<span class="status-area">';

    html +=
      '<strong class="' +
      statusClass +
      '">' +
      escapeHtml(status) +
      "</strong>";

    /* CONFIRM BUTTON */

    if (
      status.toLowerCase() === "pending"
    ) {
      html +=
        '<button ' +
        'type="button" ' +
        'class="confirm-button" ' +
        'data-row="' +
        Number(booking.row) +
        '">' +
        "Confirm" +
        "</button>";
    }

    html += "</span>";

    row.innerHTML = html;

    bookingTable.appendChild(row);
  });

  updateBookingCounts();

  /* VIEW ALL BUTTON */

  const viewAllButton =
    document.getElementById(
      "viewAllBookings"
    );

  if (viewAllButton) {
    if (
      filteredBookings.length <= 5
    ) {
      viewAllButton.style.display =
        "none";

    } else {
      viewAllButton.style.display =
        "inline-block";

      viewAllButton.textContent =
        showAllBookings
          ? "Show Recent"
          : "View All";
    }
  }
}


/* =========================================================
   UPDATE BOOKING COUNTS
========================================================= */

function updateBookingCounts() {
  const totalBookings =
    document.getElementById(
      "totalBookings"
    );

  if (totalBookings) {
    totalBookings.textContent =
      allBookingsData.length;
  }

  const pending =
    allBookingsData.filter(
      function (booking) {
        return (
          String(
            booking.status ||
            "Pending"
          ).toLowerCase() ===
          "pending"
        );
      }
    ).length;

  const pendingBookings =
    document.getElementById(
      "pendingBookings"
    );

  if (pendingBookings) {
    pendingBookings.textContent =
      pending;
  }

  const confirmed =
    allBookingsData.filter(
      function (booking) {
        return (
          String(
            booking.status || ""
          ).toLowerCase() ===
          "confirmed"
        );
      }
    ).length;

  const confirmedBookings =
    document.getElementById(
      "confirmedBookings"
    );

  if (confirmedBookings) {
    confirmedBookings.textContent =
      confirmed;
  }
}


/* =========================================================
   VIEW ALL + CONFIRM BUTTON
========================================================= */

document.addEventListener(
  "click",
  function (event) {

    const viewAllButton =
      event.target.closest(
        "#viewAllBookings"
      );

    if (viewAllButton) {
      showAllBookings =
        !showAllBookings;

      renderBookings();

      return;
    }

    const confirmButton =
      event.target.closest(
        ".confirm-button"
      );

    if (confirmButton) {
      const row =
        Number(
          confirmButton.dataset.row
        );

      confirmBooking(row);
    }
  }
);


/* =========================================================
   SEARCH
========================================================= */

document.addEventListener(
  "input",
  function (event) {

    if (
      event.target.id ===
      "bookingSearch"
    ) {
      showAllBookings = false;
      renderBookings();
    }
  }
);


/* =========================================================
   STATUS FILTER
========================================================= */

document.addEventListener(
  "change",
  function (event) {

    if (
      event.target.id ===
      "bookingStatusFilter"
    ) {
      showAllBookings = false;
      renderBookings();
    }
  }
);


/* =========================================================
   DATE FORMAT
========================================================= */

function formatDate(date) {
  if (!date) {
    return "-";
  }

  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return String(date);
  }

  return d.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}


/* =========================================================
   CONFIRM BOOKING
========================================================= */

async function confirmBooking(rowNumber) {
  const confirmed =
    confirm(
      "Confirm this booking?"
    );

  if (!confirmed) {
    return;
  }

  try {
    await fetch(
      BOOKING_API,
      {
        method: "POST",

        mode: "no-cors",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },

        body: JSON.stringify({
          action: "updateStatus",
          row: Number(rowNumber),
          status: "Confirmed"
        })
      }
    );

    alert(
      "Booking confirmed ✓"
    );

    loadBookings();

  } catch (error) {
    console.error(
      "STATUS UPDATE ERROR:",
      error
    );

    alert(
      "Could not update booking."
    );
  }
}


/* =========================================================
   LOAD GALLERY
========================================================= */

function loadGallery() {
  const gallery =
    document.getElementById(
      "adminGallery"
    );

  if (!gallery) {
    return;
  }

  gallery.innerHTML =
    '<p class="gallery-loading">' +
    "Loading gallery..." +
    "</p>";

  const callbackName =
    "galleryCallback_" +
    Date.now();

  window[callbackName] =
    function (photos) {

      const photoList =
        Array.isArray(photos)
          ? photos
          : [];

      gallery.innerHTML = "";

      /* COUNT */

      const galleryCount =
        document.getElementById(
          "galleryCount"
        );

      if (galleryCount) {
        galleryCount.textContent =
          photoList.length +
          (
            photoList.length === 1
              ? " Photo"
              : " Photos"
          );
      }

      /* STAT CARD */

      const galleryPhotos =
        document.getElementById(
          "galleryPhotos"
        );

      if (galleryPhotos) {
        galleryPhotos.textContent =
          photoList.length;
      }

      /* NO PHOTOS */

      if (
        photoList.length === 0
      ) {
        gallery.innerHTML =
          '<p class="gallery-loading">' +
          "No gallery photos found." +
          "</p>";
      }

      /* SHOW PHOTOS */

      photoList.forEach(
        function (photo) {

          const item =
            document.createElement(
              "div"
            );

          item.className =
            "gallery-item";

          /* IMAGE */

          const img =
            document.createElement(
              "img"
            );

          img.src =
            photo.url || "";

          img.alt =
            photo.name ||
            "Henna Design";

          img.loading =
            "lazy";

          /* DELETE BUTTON */

          const deleteButton =
            document.createElement(
              "button"
            );

          deleteButton.type =
            "button";

          deleteButton.className =
            "delete-photo-button";

          deleteButton.textContent =
            "Delete";

          deleteButton.dataset.id =
            photo.id || "";

          deleteButton.addEventListener(
            "click",
            function () {

              deletePhoto(
                deleteButton.dataset.id,
                deleteButton
              );
            }
          );

          item.appendChild(img);

          item.appendChild(
            deleteButton
          );

          gallery.appendChild(
            item
          );
        }
      );

      const script =
        document.getElementById(
          callbackName
        );

      if (script) {
        script.remove();
      }

      delete window[
        callbackName
      ];
    };

  /* JSONP */

  const script =
    document.createElement(
      "script"
    );

  script.id =
    callbackName;

  script.src =
    GALLERY_API +
    "?action=photos&callback=" +
    encodeURIComponent(
      callbackName
    );

  script.onerror =
    function () {

      gallery.innerHTML =
        '<p class="gallery-loading">' +
        "Could not load gallery." +
        "</p>";

      delete window[
        callbackName
      ];

      script.remove();
    };

  document.body.appendChild(
    script
  );
}


/* =========================================================
   UPLOAD PHOTO
========================================================= */

async function uploadPhoto(file) {
  if (!file) {
    return;
  }

  if (
    !file.type.startsWith(
      "image/"
    )
  ) {
    alert(
      "Please select an image file."
    );

    return;
  }

  const uploadButton =
    document.getElementById(
      "uploadButton"
    );

  const uploadStatus =
    document.getElementById(
      "uploadStatus"
    );

  if (uploadButton) {
    uploadButton.disabled = true;
    uploadButton.textContent =
      "Uploading...";
  }

  if (uploadStatus) {
    uploadStatus.textContent =
      "Uploading photo...";
  }

  try {
    const base64 =
      await new Promise(
        function (
          resolve,
          reject
        ) {

          const reader =
            new FileReader();

          reader.onload =
            function (event) {

              const result =
                String(
                  event.target.result ||
                  ""
                );

              const parts =
                result.split(",");

              if (
                parts.length < 2
              ) {
                reject(
                  new Error(
                    "Invalid image data."
                  )
                );

                return;
              }

              resolve(
                parts[1]
              );
            };

          reader.onerror =
            reject;

          reader.readAsDataURL(
            file
          );
        }
      );

    await fetch(
      GALLERY_API,
      {
        method: "POST",

        mode: "no-cors",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },

        body: JSON.stringify({
          action: "upload",
          fileName: file.name,
          mimeType: file.type,
          data: base64
        })
      }
    );

    if (uploadStatus) {
      uploadStatus.textContent =
        "Photo uploaded ✓";
    }

    alert(
      "Photo uploaded successfully ✓"
    );

    const photoInput =
      document.getElementById(
        "photoInput"
      );

    if (photoInput) {
      photoInput.value = "";
    }

    setTimeout(
      function () {
        loadGallery();
      },
      1500
    );

  } catch (error) {
    console.error(
      "UPLOAD ERROR:",
      error
    );

    if (uploadStatus) {
      uploadStatus.textContent =
        "Upload failed.";
    }

    alert(
      "Could not upload photo."
    );

  } finally {
    if (uploadButton) {
      uploadButton.disabled =
        false;

      uploadButton.textContent =
        "+ Upload Photo";
    }
  }
}


/* =========================================================
   DELETE PHOTO
========================================================= */

async function deletePhoto(
  fileId,
  button
) {
  if (
    !confirm(
      "Are you sure you want to delete this photo?"
    )
  ) {
    return;
  }

  if (!fileId) {
    alert(
      "Photo ID is missing."
    );

    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent =
      "Deleting...";
  }

  try {
    await fetch(
      GALLERY_API,
      {
        method: "POST",

        mode: "no-cors",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },

        body: JSON.stringify({
          action: "delete",
          id: fileId
        })
      }
    );

    alert(
      "Photo deleted successfully ✓"
    );

    setTimeout(
      function () {
        loadGallery();
      },
      1500
    );

  } catch (error) {
    console.error(
      "DELETE ERROR:",
      error
    );

    if (button) {
      button.disabled = false;
      button.textContent =
        "Delete";
    }

    alert(
      "Could not delete photo."
    );
  }
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   START
========================================================= */

function initAdminPanel() {

  /* LOGIN FORM */

  const loginForm =
    document.getElementById("loginForm");

  if (loginForm) {

    loginForm.addEventListener(
      "submit",
      function (event) {

        event.preventDefault();

        adminLogin();
      }
    );
  }


  /* LOGOUT */

  const logoutButton =
    document.getElementById("logoutButton");

  if (logoutButton) {

    logoutButton.addEventListener(
      "click",
      function (event) {

        event.preventDefault();

        adminLogout();
      }
    );
  }


  /* PHOTO INPUT */

  const photoInput =
    document.getElementById("photoInput");

  if (photoInput) {

    photoInput.addEventListener(
      "change",
      function () {

        const file =
          photoInput.files &&
          photoInput.files[0];

        if (file) {
          uploadPhoto(file);
        }
      }
    );
  }


  /* CHECK SESSION */

  checkAdminSession();
}


/* START ADMIN PANEL */

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    initAdminPanel
  );

} else {

  initAdminPanel();

}
