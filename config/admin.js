module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', '4e4c1b8592cfd4147fc38a870169d293'),
  },
});
