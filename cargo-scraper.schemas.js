var schemas;

schemas = {};

schemas.links = {
  '$rule': '.entry a',
  '$sanitizer': function ($elem, params) {
    return $elem.attr('href');
  }
};

schemas.internalLinks = {
  '$rule': 'a',
  '$sanitizer': function ($elem, params) {
    return $elem.attr('href');
  }
}

module.exports = schemas;
