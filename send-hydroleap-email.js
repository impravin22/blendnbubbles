const { sendEmail } = require('./send-email');

const emailContent = {
  to: 'contact.us@hydroleap.com',
  subject: 'Validated Graphene Media for Advanced Water Treatment',
  text: `Dear Hydroleap Pte Ltd Team,

AquaChar provides a scientifically validated filtration media engineered through our patented Aqua Graphene forging process. This advanced technology produces a highly structured graphene matrix that delivers superior adsorption capacity, extended media lifespan, and enhanced sustainability compared to traditional activated carbon used in industrial and electrochemical water treatment applications.

AquaChar's amphiphilic surface effectively removes heavy metals, ammonia, organic pollutants, PFAS compounds, and other dissolved contaminants. Its biologically supportive structure further promotes microbial stability, offering considerable advantages in integrated treatment systems, aquaponics, and reuse applications aligned with Hydroleap's technological mission.

You may review our certified laboratory results, research resources, and documented performance data at the following links:

Independent Laboratory Verification

https://aquachar.com/en-tw/blogs/science/science-independent-lab-verification

Scientific Research Library

https://aquachar.com/en-tw/blogs/science

Proven Water Purification Results

https://aquachar.com/en-tw/blogs/science/proven-results-aquachar-filters-deliver-powerful-water-purification

If your engineering team would like to conduct performance trials or discuss integration opportunities, please use code 47QWHQ1X7J9X for a 10 percent discount on your initial order.

Best regards,

AquaChar International Team`,
  html: `Dear Hydroleap Pte Ltd Team,<br><br>

AquaChar provides a scientifically validated filtration media engineered through our patented Aqua Graphene forging process. This advanced technology produces a highly structured graphene matrix that delivers superior adsorption capacity, extended media lifespan, and enhanced sustainability compared to traditional activated carbon used in industrial and electrochemical water treatment applications.<br><br>

AquaChar's amphiphilic surface effectively removes heavy metals, ammonia, organic pollutants, PFAS compounds, and other dissolved contaminants. Its biologically supportive structure further promotes microbial stability, offering considerable advantages in integrated treatment systems, aquaponics, and reuse applications aligned with Hydroleap's technological mission.<br><br>

You may review our certified laboratory results, research resources, and documented performance data at the following links:<br><br>

<strong>Independent Laboratory Verification</strong><br>
<a href="https://aquachar.com/en-tw/blogs/science/science-independent-lab-verification">https://aquachar.com/en-tw/blogs/science/science-independent-lab-verification</a><br><br>

<strong>Scientific Research Library</strong><br>
<a href="https://aquachar.com/en-tw/blogs/science">https://aquachar.com/en-tw/blogs/science</a><br><br>

<strong>Proven Water Purification Results</strong><br>
<a href="https://aquachar.com/en-tw/blogs/science/proven-results-aquachar-filters-deliver-powerful-water-purification">https://aquachar.com/en-tw/blogs/science/proven-results-aquachar-filters-deliver-powerful-water-purification</a><br><br>

If your engineering team would like to conduct performance trials or discuss integration opportunities, please use code <strong>47QWHQ1X7J9X</strong> for a 10 percent discount on your initial order.<br><br>

Best regards,<br><br>

AquaChar International Team`
};

sendEmail(emailContent)
  .then(() => {
    console.log('Email sent successfully to contact.us@hydroleap.com');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to send email:', error.message);
    process.exit(1);
  });

