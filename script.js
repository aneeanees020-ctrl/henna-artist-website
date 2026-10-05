/* =========================
   SMOOTH SCROLL
========================= */

document.querySelectorAll('a[href^="#"]').forEach(function(link) {

  link.addEventListener("click", function(event) {

    const targetId = this.getAttribute("href");

    const target = document.querySelector(targetId);

    if (target) {

      if (
        targetId === "#gallery-page" ||
        targetId === "#booking"
      ) {
        return;
      }

      event.preventDefault();

      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

    }

  });

});


/* =========================
   GALLERY WEB APP
========================= */

const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbyIw3aAGTmvpQ0ycwgLxBUU0ytSNQz4vDY_6y_W6AeWfUI7GjhQpLydiFyip5F87HR_3w/exec";


/* =========================
   BOOKING WEB APP
========================= */

const BOOKING_URL =
  "https://script.google.com/macros/s/AKfycbzj4Xph2X64VMXQLqKSOPhPp2s54VT-hZ44dBh81Q29GBt41t060QKf8CAb4LMblju-qA/exec";


/* =========================
   BOOKING FORM
========================= */

document.addEventListener("DOMContentLoaded", function() {

  const bookingForm =
    document.querySelector(".booking-form");

  if (bookingForm) {

    bookingForm.addEventListener("submit", function(event) {

      event.preventDefault();

      const inputs =
        bookingForm.querySelectorAll(
          "input, select, textarea"
        );

      /*
        Booking field order:

        0 = Name
        1 = Phone
        2 = Date
        3 = Event Type
        4 = Number of People
        5 = Location
        6 = Design Preference
      */

     const data = {

  action: "addBooking",

  name: inputs[0].value,

  phone: inputs[1].value,

  date: inputs[2].value,

  event: inputs[3].value,

  people: inputs[4].value,

  location: inputs[5].value,

  design: inputs[6].value

};
      console.log("Booking Data:", data);


      const button =
        bookingForm.querySelector("button");

      button.innerText = "Sending...";

      button.disabled = true;


      fetch(BOOKING_URL, {

        method: "POST",

        mode: "no-cors",

        body: JSON.stringify(data)

      })

      .then(function() {

        button.innerText =
          "Booking Sent ✓";

        bookingForm.reset();

        button.disabled = false;

      })

      .catch(function(error) {

        console.log(error);

        button.innerText =
          "Try Again";

        button.disabled = false;

      });

    });

  }

});


/* =========================
   GALLERY UPLOAD
========================= */

function uploadGalleryPhoto(input, slotNumber) {

  const file = input.files[0];

  if (!file) return;

  const slot = input.parentElement;

  slot.innerHTML =
    "<p>Uploading...</p>";

  const reader = new FileReader();

  reader.onload = function(event) {

    const base64 =
      event.target.result.split(",")[1];

    fetch(WEB_APP_URL, {

      method: "POST",

      body: JSON.stringify({

        data: base64,

        fileName: file.name,

        mimeType: file.type

      })

    })

    .then(response => response.json())

    .then(result => {

      if (result.success) {

        slot.innerHTML = `

          <img
            src="${URL.createObjectURL(file)}"
            alt="Henna Design"
            style="
              width:100%;
              height:100%;
              object-fit:cover;
            "
          >

        `;

      } else {

        throw new Error(
          result.error || "Upload failed"
        );

      }

    })

    .catch(error => {

      slot.innerHTML = `

        <span>＋</span>

        <p>Upload Failed</p>

      `;

      console.log(error);

    });

  };

  reader.readAsDataURL(file);

}


/* =========================
   LOAD GALLERY PHOTOS
========================= */

function loadGalleryPhotos() {

  const script =
    document.createElement("script");

  const callbackName =
    "galleryPhotosCallback";

  window[callbackName] =
    function(photos) {

      photos.forEach(function(photo, index) {

        const slot =
          document.querySelectorAll(
            ".upload-slot"
          )[index];

        if (!slot) return;

        slot.innerHTML = `

          <img
            src="${photo.url}"
            alt="Henna Design"
            style="
              width:100%;
              height:100%;
              object-fit:cover;
            "
          >

        `;

      });

      script.remove();

      delete window[callbackName];

    };


  script.src =
    WEB_APP_URL +
    "?action=photos&callback=" +
    callbackName;

  document.body.appendChild(script);

}


/* =========================
   PAGE LOAD
========================= */

document.addEventListener(
  "DOMContentLoaded",
  function() {

    loadGalleryPhotos();

    const backHome =
      document.querySelector(".back-home");

    if (backHome) {

      backHome.addEventListener(
        "click",
        function() {

          window.location.hash = "";

        }
      );

    }

  }
);


/* =========================
   BOOKING BACK HOME
========================= */

const bookingBackHome =
  document.querySelector(".booking-back-home");

if (bookingBackHome) {

  bookingBackHome.addEventListener(
    "click",
    function() {

      window.location.hash = "";

    }

  );

}

// Secret Admin Access

let adminSecret = "";

document.addEventListener("keydown", function (event) {

  adminSecret += event.key.toLowerCase();

  if (adminSecret.length > 5) {
    adminSecret = adminSecret.slice(-5);
  }

  if (adminSecret === "admin") {

    const adminButton =
      document.getElementById("hiddenAdminButton");

    if (adminButton) {
      adminButton.classList.toggle("show");
    }

    adminSecret = "";
  }

});
